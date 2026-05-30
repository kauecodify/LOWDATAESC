import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '2m', target: 5000 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post('http://tx-service:3000/v1/transactions', JSON.stringify({
    type: 'transfer', amount: 1500.00, recipient: 'escrow_789',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(0.1);
}
