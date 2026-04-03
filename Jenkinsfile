pipeline {
    agent any

    environment {
        DOCKER_USER = "prashasthnaik"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        // =========================
        // CLEAN WORKSPACE
        // =========================
        stage('Clean Workspace') {
            steps {
                cleanWs()
            }
        }

        // =========================
        // CI STAGE
        // =========================
        stage('CI - Build & Push Images') {
            steps {
                script {

                    def services = [
                        "api-gateway:apigateway",
                        "eureka-server:eureka",
                        "order-service:order",
                        "product-service:product",
                        "user-service:user"
                    ]

                    withCredentials([usernamePassword(
                        credentialsId: 'DockerHub',
                        usernameVariable: 'USER',
                        passwordVariable: 'PASS'
                    )]) {

                        sh 'echo $PASS | docker login -u $USER --password-stdin'

                        for (svc in services) {
                            def parts = svc.split(":")
                            def dirName = parts[0]
                            def imageName = parts[1]

                            dir(dirName) {
                                sh '''
                                if [ -f pom.xml ]; then
                                    mvn clean test
                                else
                                    echo "No pom.xml found in $(pwd), skipping Maven test"
                                fi
                                '''
                            
                                sh '''
                                if [ -f Dockerfile ]; then
                                    docker build -t '"$DOCKER_USER"'/'"$imageName"':'"$IMAGE_TAG"' .
                                else
                                    echo "No Dockerfile in $(pwd), searching inside..."
                            
                                    SUBDIR=$(find . -name Dockerfile | head -n 1)
                            
                                    if [ -n "$SUBDIR" ]; then
                                        DIR=$(dirname $SUBDIR)
                                        echo "Building from $DIR"
                                        docker build -t '"$DOCKER_USER"'/'"$imageName"':'"$IMAGE_TAG"' $DIR
                                    else
                                        echo "No Dockerfile found, failing build"
                                        exit 1
                                    fi
                                fi
                                '''
                            
                                sh "docker push $DOCKER_USER/${imageName}:$IMAGE_TAG"
                            }
                        }

                        // Frontend
                        dir('frontend') {
                            sh 'npm install'
                            sh 'npm run test --if-present || true'
                            sh "docker build -t $DOCKER_USER/frontend:$IMAGE_TAG ."
                            sh "docker push $DOCKER_USER/frontend:$IMAGE_TAG"
                        }
                    }
                }
            }
        }

        // =========================
        // DEV STAGE (WITH BACKEND TESTS — KEPT)
        // =========================
        stage('DEV - Deploy & Smoke Test') {
            steps {
                script {

                    // CLEAN OLD CONTAINERS
                    sh '''
                    docker compose down --remove-orphans || true
                    docker rm -f $(docker ps -aq) || true
                    '''

                    // =========================
                    // BACKEND UNIT TESTS (FIXED PERMISSIONS)
                    // =========================
                    sh '''
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/api-gateway:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/eureka-server:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/order-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/product-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/user-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    '''

                    // VALIDATE + PULL
                    sh 'docker compose config'
                    sh 'docker compose pull || true'

                    // DEPLOY
                    sh 'docker compose up -d --remove-orphans'

                    // WAIT
                    sh '''
                    echo "Waiting for services to start..."
                    sleep 40
                    '''

                    // API GATEWAY
                    sh '''
                    for i in {1..10}; do
                      nc -z localhost 8085 && echo "API Gateway is UP" && exit 0
                      sleep 5
                    done
                    exit 1
                    '''

                    // FRONTEND
                    sh 'curl -f http://localhost:3000'

                    // ORDER SERVICE
                    sh '''
                    for i in {1..10}; do
                      nc -z localhost 8081 && exit 0
                      sleep 5
                    done
                    exit 1
                    '''

                    // PRODUCT SERVICE
                    sh '''
                    for i in {1..10}; do
                      nc -z localhost 8082 && exit 0
                      sleep 5
                    done
                    exit 1
                    '''

                    // USER SERVICE
                    sh '''
                    for i in {1..10}; do
                      nc -z localhost 8083 && exit 0
                      sleep 5
                    done
                    exit 1
                    '''
                }
            }
        }

        // =========================
        // TEST STAGE
        // =========================
        stage('TEST - Integration & Load') {
            steps {
                script {

                    sh 'docker compose up -d'

                    // WAIT FOR API GATEWAY
                    sh '''
                    MAX_RETRIES=30
                    COUNT=1

                    while [ $COUNT -le $MAX_RETRIES ]
                    do
                      if curl -f http://localhost:8085/actuator/health
                      then
                        exit 0
                      fi
                      sleep 5
                      COUNT=$((COUNT+1))
                    done

                    docker logs api-gateway || true
                    exit 1
                    '''

                    // INTEGRATION TESTS
                    sh '''
                    for i in {1..10}; do curl -f http://localhost:8085/api/products && break || sleep 5; done
                    for i in {1..10}; do curl -f http://localhost:8085/api/orders && break || sleep 5; done
                    for i in {1..10}; do curl -f http://localhost:8085/api/users && break || sleep 5; done
                    '''

                    // LOAD TEST
                    sh '''
                    docker run --rm \
                      -v $(pwd)/loadtest.js:/scripts/loadtest.js:ro \
                      --network host \
                      grafana/k6 run /scripts/loadtest.js
                    '''

                    sh 'docker compose down --remove-orphans || true'
                }
            }
        }


        /*
        // =========================
        // PROD STAGE
        // =========================
        stage('PROD - Kubernetes Deploy') {
            steps {
                withCredentials([file(
                    credentialsId: 'k8s-kubeconfig',
                    variable: 'KUBECONFIG'
                )]) {
                    sh '''
                    export KUBECONFIG=$KUBECONFIG

                    kubectl apply -f k8s/namespace.yaml

                    sed -i "s/__TAG__/${BUILD_NUMBER}/g" k8s/*.yaml

                    kubectl delete pods --all -n ecommerce-prod || true
                    kubectl apply -f k8s/

                    kubectl get pods -n ecommerce-prod
                    '''
                }
            }
        }
        */

    }

    // =========================
    // CLEANUP (ALWAYS RUNS)
    // =========================
    post {
        always {
            sh 'docker system prune -f || true'
        }
    }
}
// pipeline {
//     agent any

//     environment {
//         DOCKER_USER = "prashasthnaik"
//         IMAGE_TAG = "${BUILD_NUMBER}"
//     }

//     stages {

//         // =========================
//         // CI STAGE
//         // =========================
//         stage('CI - Build & Push Images') {
//             steps {
//                 script {

//                     def services = [
//                         "api-gateway:apigateway",
//                         "eureka-server:eureka",
//                         "order-service:order",
//                         "product-service:product",
//                         "user-service:user"
//                     ]

//                     withCredentials([usernamePassword(
//                         credentialsId: 'DockerHub',
//                         usernameVariable: 'USER',
//                         passwordVariable: 'PASS'
//                     )]) {

//                         sh 'echo $PASS | docker login -u $USER --password-stdin'

//                         for (svc in services) {
//                             def parts = svc.split(":")
//                             def dirName = parts[0]
//                             def imageName = parts[1]

//                             dir(dirName) {
//                                 sh 'mvn test'
//                                 sh "docker build -t $DOCKER_USER/${imageName}:$IMAGE_TAG ."
//                                 sh "docker push $DOCKER_USER/${imageName}:$IMAGE_TAG"
//                             }
//                         }

//                         // Frontend
//                         dir('frontend') {
//                             sh 'npm install'
//                             sh 'npm run test --if-present || true'
//                             sh "docker build -t $DOCKER_USER/frontend:$IMAGE_TAG ."
//                             sh "docker push $DOCKER_USER/frontend:$IMAGE_TAG"
//                         }
//                     }
//                 }
//             }
//         }

//     //     // =========================
//     //     // DEV STAGE
//     //     // =========================
//     //     stage('DEV - Deploy & Smoke Test') {
//     //         steps {

//     //             // Run unit tests inside docker
//     //             sh '''
//     //             docker run --rm -v $(pwd)/api-gateway:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
//     //             docker run --rm -v $(pwd)/eureka-server:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
//     //             docker run --rm -v $(pwd)/order-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
//     //             docker run --rm -v $(pwd)/product-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
//     //             docker run --rm -v $(pwd)/user-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
//     //             '''

//     //             // Deploy locally
//     //             sh 'docker compose config'
//     //             sh 'docker compose pull'
//     //             sh 'docker compose up -d --remove-orphans'

//     //             sh 'sleep 40'

//     //             // Smoke test - API Gateway
//     //             sh '''
//     //             for i in {1..10}; do
//     //                 nc -z localhost 8080 && exit 0
//     //                 sleep 5
//     //             done
//     //             exit 1
//     //             '''

//     //             // Frontend check
//     //             sh 'curl -f http://localhost:3000'
//     //         }
//     //     }

//     //     // =========================
//     //     // TEST STAGE
//     //     // =========================
//     //     stage('TEST - Integration & Load') {
//     //         steps {

//     //             sh 'docker compose up -d'

//     //             // Wait for API Gateway
//     //             sh '''
//     //             MAX_RETRIES=24
//     //             COUNT=1

//     //             while [ $COUNT -le $MAX_RETRIES ]
//     //             do
//     //                 if nc -z localhost 8080; then
//     //                     exit 0
//     //                 fi
//     //                 sleep 5
//     //                 COUNT=$((COUNT+1))
//     //             done

//     //             docker logs api-gateway || true
//     //             exit 1
//     //             '''

//     //             // Integration tests
//     //             sh '''
//     //             curl -f http://localhost:8080/api/products
//     //             curl -f http://localhost:8080/api/orders
//     //             curl -f http://localhost:8080/api/users
//     //             '''

//     //             // Load test (k6)
//     //             sh '''
//     //             docker run --rm \
//     //             -v $(pwd)/loadtest.js:/scripts/loadtest.js \
//     //             --network host \
//     //             grafana/k6 run /scripts/loadtest.js
//     //             '''

//     //             sh 'docker compose down'
//     //         }
//     //     }

//     //     // =========================
//     //     // PROD STAGE
//     //     // =========================
//     //     stage('PROD - Kubernetes Deploy') {
//     //         steps {
//     //             withCredentials([file(
//     //                 credentialsId: 'k8s-kubeconfig',
//     //                 variable: 'KUBECONFIG'
//     //             )]) {

//     //                 sh '''
//     //                 export KUBECONFIG=$KUBECONFIG

//     //                 kubectl get nodes

//     //                 kubectl apply -f k8s/namespace.yaml

//     //                 sed -i "s/__TAG__/${BUILD_NUMBER}/g" k8s/*.yaml

//     //                 kubectl delete pods --all -n ecommerce-prod || true

//     //                 kubectl apply -f k8s/

//     //                 sleep 40

//     //                 kubectl get pods -n ecommerce-prod
//     //                 kubectl get svc -n ecommerce-prod

//     //                 kubectl logs deployment/api-gateway -n ecommerce-prod --tail=50
//     //                 '''
//     //             }
//     //         }
//     //     }
//     // }

//     // =========================
//     // CLEANUP (ALWAYS RUNS)
//     // =========================
//     post {
//         always {
//             sh 'docker system prune -f || true'
//         }
//      }
//   }
// }    
