import autocannon from 'autocannon';

const url = process.env.BENCH_URL ?? 'http://127.0.0.1:3000/';
const targets = (
  process.env.BENCH_TARGETS ??
  'https://example.com/?p=1,https://example.com/?p=2,https://example.com/?p=3,https://example.com/?p=4'
).split(',');
const duration = Number(process.env.BENCH_DURATION ?? 30);
const connections = Number(process.env.BENCH_CONNECTIONS ?? 8);

console.log(`▶ cold-cache (${targets.length} unique URLs) | ${connections} conns / ${duration}s`);

let i = 0;
const result = await autocannon({
  url,
  duration,
  connections,
  pipelining: 1,
  setupClient: (client) => {
    client.setHeaders({
      'user-agent': 'Googlebot/2.1',
      'x-render-url': targets[i++ % targets.length] ?? targets[0]!,
      'cache-control': 'no-cache',
    });
  },
});
console.log(autocannon.printResult(result));
console.log(`Cold render p95: ${result.latency.p95} ms`);
console.log(`Cold render p99: ${result.latency.p99} ms`);
