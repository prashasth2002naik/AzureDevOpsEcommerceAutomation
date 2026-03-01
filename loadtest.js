import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,           // number of virtual users
  duration: '20s',   // how long test runs
  thresholds: {
    http_req_duration: ['p(95)<800'],  // 95% under 800ms
    http_req_failed: ['rate<0.01'],    // less than 1% errors
  },
};

export default function () {
  let res = http.get('http://localhost:8080/api/products');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}