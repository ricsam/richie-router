import { startDemoServer } from './app';

const server = startDemoServer({
  port: Number(process.env.PORT ?? 3000),
});

console.log(`Richie Router demo running at ${server.url}`);
