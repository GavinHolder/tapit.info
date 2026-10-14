export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMailLoop } = await import('./lib/mail');
    startMailLoop();
  }
}
