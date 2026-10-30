// Boot: mount the app (through the artifact's hot-update hook when present).
import { App } from './ui/App.jsx';

class Boundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="crash">
          <h2>Something broke in the trials.</h2>
          <pre>{String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err))}</pre>
          <button type="button" className="btn" onClick={() => this.setState({ err: null })}>
            Try to continue
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function start(data) {
  const el = document.getElementById('root');
  const root = ReactDOM.createRoot(el);
  root.render(
    <Boundary>
      <App initial={data && (data.screen || data.sel) ? data : null} />
    </Boundary>,
  );
}

const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start);
else start((hot && hot.data) || {});
