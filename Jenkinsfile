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
        // DEV STAGE
        // =========================
        stage('DEV - Deploy & Smoke Test') {
            steps {

                sh 'docker compose down --remove-orphans || true'
                sh 'docker compose up -d --remove-orphans'
                sh 'sleep 40'

                sh '''
                echo "Waiting for API Gateway to be ready..."
                
                MAX_RETRIES=30
                RETRY_DELAY=5
                COUNT=1
                
                while [ $COUNT -le $MAX_RETRIES ]
                do
                  echo "Attempt $COUNT..."
                
                  RESPONSE=$(curl -s http://localhost:8085/actuator/health || true)
                
                  echo "Response: $RESPONSE"
                
                  echo "$RESPONSE" | grep '"status":"UP"' && echo "Gateway is READY" && exit 0
                
                  echo "Still starting..."
                  sleep $RETRY_DELAY
                  COUNT=$((COUNT+1))
                done
                
                echo "Gateway failed to start"
                docker logs api-gateway || true
                exit 1
                '''
                sh 'curl -f http://localhost:3000'

                script {

                    // =========================
                    // CLEAN OLD CONTAINERS (IMPORTANT)
                    // =========================
                    sh '''
                    docker compose down --remove-orphans || true
                    docker rm -f $(docker ps -aq) || true
                    '''

                    // =========================
                    // BACKEND UNIT TESTS (IN DOCKER)
                    // =========================
                    sh '''
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/api-gateway:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/eureka-server:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/order-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/product-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    docker run --rm -u $(id -u):$(id -g) -v $(pwd)/user-service:/app -w /app maven:3.9.6-eclipse-temurin-17 mvn clean test
                    '''

                    // =========================
                    // VALIDATE + PULL
                    // =========================
                    sh 'docker compose config'
                    sh 'docker compose pull || true'

                    // =========================
                    // DEPLOY
                    // =========================
                    sh 'docker compose up -d --remove-orphans'

                    // =========================
                    // WAIT
                    // =========================
                    sh '''
                    echo "Waiting for services to start..."
                    sleep 40
                    '''

                    // =========================
                    // SMOKE TEST - API GATEWAY (UPDATED PORT)
                    // =========================
                    sh '''
                    echo "Smoke Test: API Gateway"
                    for i in {1..10}; do
                        nc -z localhost 8085 && echo "API Gateway is UP" && exit 0
                        sleep 5
                    done
                    exit 1
                    '''

                    // =========================
                    // FRONTEND
                    // =========================
                    sh '''
                    echo "Smoke Test: Frontend"
                    curl -f http://localhost:3000
                    '''

                    // =========================
                    // ORDER SERVICE
                    // =========================
                    sh '''
                    echo "Smoke Test: Order Service"
                    for i in {1..10}; do
                        nc -z localhost 8081 && echo "Order Service is UP" && exit 0
                        sleep 5
                    done
                    exit 1
                    '''

                    // =========================
                    // PRODUCT SERVICE
                    // =========================
                    sh '''
                    echo "Smoke Test: Product Service"
                    for i in {1..10}; do
                        nc -z localhost 8082 && echo "Product Service is UP" && exit 0
                        sleep 5
                    done
                    exit 1
                    '''

                    // =========================
                    // USER SERVICE
                    // =========================
                    sh '''
                    echo "Smoke Test: User Service"
                    for i in {1..10}; do
                        nc -z localhost 8083 && echo "User Service is UP" && exit 0
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
        
                    // ---------------------------------
                    // Start Services
                    // ---------------------------------
                    sh '''
                    echo "Starting TEST environment services..."
                    docker compose up -d
                    docker ps
                    '''
        
                    // ---------------------------------
                    // Wait for API Gateway Port
                    // ---------------------------------
                    sh '''
                    echo "Waiting for API Gateway to be ready..."
                    
                    MAX_RETRIES=30
                    RETRY_DELAY=5
                    COUNT=1
                    
                    while [ $COUNT -le $MAX_RETRIES ]
                    do
                      echo "Attempt $COUNT..."
                    
                      RESPONSE=$(curl -s http://localhost:8085/actuator/health || true)
                    
                      echo "Response: $RESPONSE"
                    
                      echo "$RESPONSE" | grep '"status":"UP"' && echo "Gateway is READY" && exit 0
                    
                      echo "Still starting..."
                      sleep $RETRY_DELAY
                      COUNT=$((COUNT+1))
                    done
                    
                    echo "Gateway failed to start"
                    docker logs api-gateway || true
                    exit 1
                    '''
                    sh 'docker ps'
                    sh 'docker logs api-gateway | tail -50 || true'
                    // ---------------------------------
                    // Integration Tests (UNCHANGED)
                    // ---------------------------------
                    // sh '''
                    // echo "Running Integration Tests..."
        
                    // curl -f http://localhost:8085/api/products
                    // curl -f http://localhost:8085/api/orders
                    // curl -f http://localhost:8085/api/users
        
                    // echo "Integration Tests PASSED"
                    // '''
                    sh '''
                    echo "Running Integration Tests..."
                    
                    set +e   # don't stop immediately
                    
                    curl -v http://localhost:8085/api/products
                    PRODUCT_STATUS=$?
                    
                    curl -v http://localhost:8085/api/orders
                    ORDER_STATUS=$?
                    
                    curl -v http://localhost:8085/api/users
                    USER_STATUS=$?
                    
                    echo "Statuses:"
                    echo "Products: $PRODUCT_STATUS"
                    echo "Orders: $ORDER_STATUS"
                    echo "Users: $USER_STATUS"
                    
                    if [ $PRODUCT_STATUS -ne 0 ] || [ $ORDER_STATUS -ne 0 ] || [ $USER_STATUS -ne 0 ]; then
                      echo "Integration FAILED"
                    
                      echo "==== API GATEWAY LOGS ===="
                      docker logs api-gateway | tail -50 || true
                    
                      echo "==== PRODUCT SERVICE LOGS ===="
                      docker logs product-service | tail -50 || true
                    
                      exit 1
                    fi
                    
                    echo "Integration PASSED"
                    '''
        
                    // ---------------------------------
                    // Load Test (k6)
                    // ---------------------------------
                    sh '''
                    echo "Running k6 Load Test..."
        
                    # Verify file exists
                    ls -la $(pwd)
        
                    docker run --rm \
                      -v $(pwd)/loadtest.js:/scripts/loadtest.js:ro \
                      --network host \
                      grafana/k6 run /scripts/loadtest.js
                    '''
        
                    // ---------------------------------
                    // Cleanup
                    // ---------------------------------
                    sh '''
                    echo "Stopping TEST services..."
                    docker compose down
                    '''
                }
            }
        
            // ---------------------------------
            // Always cleanup (equivalent to condition: always())
            // ---------------------------------
            post {
                always {
                    sh 'docker compose down || true'
                    // echo "Skipping cleanup for debugging"
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
            // echo "Skipping cleanup for debugging"
        }
    }
}
