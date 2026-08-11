const ERROR_MESSAGES: Record<string, string> = {
  not_member: 'You need to be a member of the Discord server to sign in.',
  denied: 'Discord sign-in was cancelled.',
  state: 'Sign-in expired — please try again.',
  token: 'Discord sign-in failed — please try again.',
};

export default function Login() {
  const error = new URLSearchParams(window.location.search).get('error');
  return (
    <div className="login">
      <h1>Neil Young Tier Lists</h1>
      <p className="tagline">40 weeks. All the albums. Rank them.</p>
      {error && <p className="login-error">{ERROR_MESSAGES[error] ?? 'Sign-in failed — please try again.'}</p>}
      <a className="discord-btn" href="/api/auth/login">
        Sign in with Discord
      </a>
    </div>
  );
}
