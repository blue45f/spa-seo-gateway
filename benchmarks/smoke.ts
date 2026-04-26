import autocannon from 'autocannon';

const url = process.env.BENCH_URL ?? 'http://127.0.0.1:3000/';
const target = process.env.BENCH_TARGET ?? 'https://example.com/';
const duration = Number(process.env.BENCH_DURATION ?? 20);
const connections = Number(process.env.BENCH_CONNECTIONS ?? 50);

console.log(`▶ smoke test: ${url} -> ${target} | ${connections} conns / ${duration}s`);

const result = await autocannon({
  url,
  duration,
  connections,
  pipelining: 1,
  headers: {
    'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    'x-render-url': target,
  },
});

console.log(autocannon.printResult(result));
