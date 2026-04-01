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
