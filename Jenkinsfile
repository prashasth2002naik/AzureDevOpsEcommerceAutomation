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
                                sh 'mvn clean test'
                                sh "docker build -t $DOCKER_USER/${imageName}:$IMAGE_TAG ."
                                sh "docker push $DOCKER_USER/${imageName}:$IMAGE_TAG"
                            }
                        }

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

                // Clean
                sh 'docker compose down --remove-orphans || true'

                // Start ONLY backend first (NO GATEWAY DEPENDENCY ISSUE)
                sh 'docker compose up -d eureka-server product-service order-service user-service'
                sh 'sleep 20'

                // =========================
                // WAIT FOR EUREKA REGISTRATION (CRITICAL FIX)
                // =========================
                sh '''
                echo "Waiting for services to register in Eureka..."

                for i in {1..20}; do
                  RESPONSE=$(curl -s http://localhost:8761/eureka/apps)

                  echo "$RESPONSE"

                  echo "$RESPONSE" | grep PRODUCT-SERVICE && \
                  echo "$RESPONSE" | grep ORDER-SERVICE && \
                  echo "$RESPONSE" | grep USER-SERVICE && \
                  echo "All services registered!" && exit 0

                  echo "Waiting for services..."
                  sleep 5
                done

                echo "Services not registered in Eureka"
                exit 1
                '''

                // =========================
                // NOW START API GATEWAY + FRONTEND
                // =========================
                sh 'docker compose up -d api-gateway frontend'
                sh 'sleep 20'

                // =========================
                // WAIT FOR GATEWAY
                // =========================
                sh '''
                echo "Waiting for API Gateway to be ready..."

                for i in {1..20}; do
                  curl -s http://localhost:8085/actuator/health | grep UP && echo "Gateway READY" && exit 0
                  echo "Still starting..."
                  sleep 5
                done

                echo "Gateway failed"
                docker logs api-gateway || true
                exit 1
                '''

                // Frontend test
                sh 'curl -f http://localhost:3000'

                // =========================
                // BACKEND UNIT TESTS
                // =========================
                sh '''
                docker run --rm -u $(id -u):$(id -g) -v $(pwd)/api-gateway:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                docker run --rm -u $(id -u):$(id -g) -v $(pwd)/eureka-server:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                docker run --rm -u $(id -u):$(id -g) -v $(pwd)/order-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                docker run --rm -u $(id -u):$(id -g) -v $(pwd)/product-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                docker run --rm -u $(id -u):$(id -g) -v $(pwd)/user-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                '''
            }
        }

        // =========================
        // TEST STAGE
        // =========================
        stage('TEST - Integration & Load') {
            steps {
                script {

                    sh '''
                    echo "Running Integration Tests..."

                    curl -f http://localhost:8085/api/products
                    curl -f http://localhost:8085/api/orders
                    curl -f http://localhost:8085/api/users

                    echo "Integration PASSED"
                    '''

                    sh '''
                    echo "Running k6 Load Test..."

                    docker run --rm \
                      -v $(pwd)/loadtest.js:/scripts/loadtest.js:ro \
                      --network host \
                      grafana/k6 run /scripts/loadtest.js
                    '''

                    sh 'docker compose down'
                }
            }

            post {
                always {
                    sh 'docker compose down || true'
                }
            }
        }
    }

    // =========================
    // CLEANUP
    // =========================
    post {
        always {
            sh 'docker system prune -f || true'
        }
    }
}
