import { Hono } from 'hono';
import { authRoutes } from './auth';
import { apiRoutes } from './api';
import type { AppContext } from './types';

const app = new Hono<AppContext>().basePath('/api');

app.route('/auth', authRoutes);
app.route('/', apiRoutes);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'server error' }, 500);
});

export default app;
