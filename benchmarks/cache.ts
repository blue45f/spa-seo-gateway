import autocannon from 'autocannon';

const url = process.env.BENCH_URL ?? 'http://127.0.0.1:3000/';
const target = process.env.BENCH_TARGET ?? 'https://example.com/';
const duration = Number(process.env.BENCH_DURATION ?? 30);
const connections = Number(process.env.BENCH_CONNECTIONS ?? 200);

console.log('1) warming cache (single request)');
await autocannon({
  url,
  amount: 1,
  connections: 1,
  headers: {
    'user-agent': 'Googlebot/2.1',
    'x-render-url': target,
  },
});

console.log(`2) hot-cache load: ${connections} conns / ${duration}s`);
const result = await autocannon({
  url,
  duration,
  connections,
  pipelining: 4,
  headers: {
    'user-agent': 'Googlebot/2.1',
    'x-render-url': target,
  },
});

console.log(autocannon.printResult(result));
console.log(`Average latency: ${result.latency.average} ms`);
console.log(`p99: ${result.latency.p99} ms`);
console.log(`Throughput: ${(result.throughput.average / 1024).toFixed(2)} KiB/s`);
console.log(`Requests/sec: ${result.requests.average}`);
