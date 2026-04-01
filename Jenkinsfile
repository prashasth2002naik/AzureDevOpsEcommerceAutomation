pipeline {
    agent any

    environment {
        DOCKER_USER = "prashasthnaik"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        // =========================
        // CI STAGE
        // =========================
        stage('CI - Build & Test') {
            steps {
                script {
                    def services = [
                        "api-gateway:apigateway",
                        "eureka-server:eureka",
                        "order-service:order",
                        "product-service:product",
                        "user-service:user"
                    ]

                    withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
                        sh 'echo $PASS | docker login -u $USER --password-stdin'

                        for (svc in services) {
                            def parts = svc.split(":")
                            def dirName = parts[0]
                            def imageName = parts[1]

                            dir(dirName) {
                                sh 'mvn test'
                                sh "docker build -t $DOCKER_USER/${imageName}:$IMAGE_TAG ."
                                sh "docker push $DOCKER_USER/${imageName}:$IMAGE_TAG"
                            }
                        }

                        // Frontend separately
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
        // DEV STAGE
        // =========================
        stage('DEV - Deploy & Smoke Test') {
            steps {

                // Unit tests inside Docker
                sh '''
                docker run --rm -v $(pwd)/api-gateway:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
                docker run --rm -v $(pwd)/eureka-server:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
                docker run --rm -v $(pwd)/order-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
                docker run --rm -v $(pwd)/product-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
                docker run --rm -v $(pwd)/user-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn test
                '''

                sh 'docker compose config'
                sh 'docker compose pull'
                sh 'docker compose up -d --remove-orphans'

                sh 'sleep 40'

                // Smoke Tests
                sh '''
                for i in {1..10}; do
                  nc -z localhost 8080 && echo "API Gateway UP" && exit 0
                  sleep 5
                done
                exit 1
                '''

                sh 'curl -f http://localhost:3000'

                sh '''
                for i in {1..10}; do
                  nc -z localhost 8081 && exit 0
                  sleep 5
                done
                exit 1
                '''

                sh '''
                for i in {1..10}; do
                  nc -z localhost 8082 && exit 0
                  sleep 5
                done
                exit 1
                '''

                sh '''
                for i in {1..10}; do
                  nc -z localhost 8083 && exit 0
                  sleep 5
                done
                exit 1
                '''
            }
        }

        // =========================
        // TEST STAGE
        // =========================
        stage('TEST - Integration & Load') {
            steps {

                sh 'docker compose up -d'
                sh 'docker ps'

                // Wait for API Gateway
                sh '''
                MAX_RETRIES=24
                COUNT=1

                while [ $COUNT -le $MAX_RETRIES ]
                do
                  if nc -z localhost 8080; then
                    echo "API Gateway UP"
                    exit 0
                  fi
                  sleep 5
                  COUNT=$((COUNT+1))
                done

                docker logs api-gateway || true
                exit 1
                '''

                // Integration tests
                sh '''
                curl -f http://localhost:8080/api/products
                curl -f http://localhost:8080/api/orders
                curl -f http://localhost:8080/api/users
                '''

                // Load test
                sh '''
                docker run --rm \
                -v $(pwd)/loadtest.js:/scripts/loadtest.js \
                --network host \
                grafana/k6 run /scripts/loadtest.js
                '''

                // Cleanup
                sh 'docker compose down'
            }
        }

        // =========================
        // PROD STAGE
        // =========================
        stage('PROD - Kubernetes Deploy') {
            steps {
                withCredentials([file(credentialsId: 'k8s-kubeconfig', variable: 'KUBECONFIG')]) {
                    sh '''
                    export KUBECONFIG=$KUBECONFIG

                    kubectl get nodes
                    kubectl apply -f k8s/namespace.yaml

                    sed -i "s/__TAG__/${BUILD_NUMBER}/g" k8s/*.yaml

                    kubectl delete pods --all -n ecommerce-prod || true
                    kubectl apply -f k8s/

                    sleep 40

                    kubectl get pods -n ecommerce-prod
                    kubectl get svc -n ecommerce-prod

                    kubectl logs deployment/api-gateway -n ecommerce-prod --tail=50
                    '''
                }
            }
        }
    }
}pipeline {
    agent any

    environment {
        DOCKER_USER = "prashasthnaik"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        // =========================
        // CI STAGE
        // =========================
        stage('CI - Build & Test') {
            parallel {

                stage('API Gateway') {
                    steps {
                        dir('api-gateway') {
                            sh 'mvn test'
                            sh "docker build -t $DOCKER_USER/apigateway:$IMAGE_TAG ."
                            sh "docker push $DOCKER_USER/apigateway:$IMAGE_TAG"
                        }
                    }
                }

                stage('Eureka') {
                    steps {
                        dir('eureka-server') {
                            sh 'mvn test'
                            sh "docker build -t $DOCKER_USER/eureka:$IMAGE_TAG ."
                            sh "docker push $DOCKER_USER/eureka:$IMAGE_TAG"
                        }
                    }
                }

                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm install'
                            sh 'npm test -- --watch=false'
                            sh "docker build -t $DOCKER_USER/frontend:$IMAGE_TAG ."
                            sh "docker push $DOCKER_USER/frontend:$IMAGE_TAG"
                        }
                    }
                }
            }
        }

        // =========================
        // DEV STAGE
        // =========================
        stage('DEV - Deploy & Smoke Test') {
            steps {
                sh 'docker compose up -d --remove-orphans'
                sh 'sleep 40'

                sh 'nc -z localhost 8080'
                sh 'curl -f http://localhost:3000'
            }
        }

        // =========================
        // TEST STAGE
        // =========================
        stage('TEST - Integration & Load') {
            steps {
                sh 'curl -f http://localhost:8080/api/products'
                sh 'curl -f http://localhost:8080/api/orders'
                sh 'curl -f http://localhost:8080/api/users'

                sh '''
                docker run --rm \
                -v $(pwd)/loadtest.js:/scripts/loadtest.js \
                --network host \
                grafana/k6 run /scripts/loadtest.js
                '''
            }
        }

        // =========================
        // PROD STAGE
        // =========================
        stage('PROD - Kubernetes Deploy') {
            steps {
                withCredentials([file(credentialsId: 'k8s-kubeconfig', variable: 'KUBECONFIG')]) {
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
    }
}
