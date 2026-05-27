import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error Boundary: 防止子组件报错导致整个应用白屏
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('应用错误:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#e87c7c', fontFamily: 'system-ui', textAlign: 'center' }}>
          <h2>页面出错了</h2>
          <p style={{ color: '#999', fontSize: 14 }}>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 16, padding: '8px 24px', borderRadius: 8, border: '1px solid #e87c7c', background: 'transparent', color: '#e87c7c', cursor: 'pointer' }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
