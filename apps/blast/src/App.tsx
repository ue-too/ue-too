import React, { useState } from 'react';
import { StateMachineBuilder } from './components/StateMachineBuilder';
import { ObjectSchemaBuilder } from './components/ObjectSchemaBuilder';

type Page = 'home' | 'state-machine' | 'object-schema';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  return (
    <div className="app">
      <nav style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        padding: '20px', 
        marginBottom: '20px',
        borderRadius: '0 0 12px 12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.5em' }}>Blast Tools</h1>
          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
            <button
              onClick={() => setCurrentPage('home')}
              style={{
                padding: '10px 20px',
                background: currentPage === 'home' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: currentPage === 'home' ? 600 : 400,
              }}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentPage('state-machine')}
              style={{
                padding: '10px 20px',
                background: currentPage === 'state-machine' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: currentPage === 'state-machine' ? 600 : 400,
              }}
            >
              State Machine Builder
            </button>
            <button
              onClick={() => setCurrentPage('object-schema')}
              style={{
                padding: '10px 20px',
                background: currentPage === 'object-schema' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: currentPage === 'object-schema' ? 600 : 400,
              }}
            >
              Object Schema Builder
            </button>
          </div>
        </div>
      </nav>

      {currentPage === 'home' && (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2em', marginBottom: '20px' }}>Welcome to Blast Tools</h2>
          <p style={{ fontSize: '1.2em', color: '#666', marginBottom: '40px' }}>
            Choose a tool from the navigation above to get started
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', maxWidth: '800px', margin: '0 auto' }}>
            <div
              onClick={() => setCurrentPage('state-machine')}
              style={{
                background: 'white',
                padding: '30px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '3em', marginBottom: '15px' }}>🔄</div>
              <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>State Machine Builder</h3>
              <p style={{ color: '#666' }}>Create state machines visually with states, events, and transitions</p>
            </div>
            <div
              onClick={() => setCurrentPage('object-schema')}
              style={{
                background: 'white',
                padding: '30px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '3em', marginBottom: '15px' }}>📋</div>
              <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Object Schema Builder</h3>
              <p style={{ color: '#666' }}>Define data schemas with primitives, arrays, and nested structures</p>
            </div>
          </div>
        </div>
      )}

      {currentPage === 'state-machine' && <StateMachineBuilder />}
      {currentPage === 'object-schema' && <ObjectSchemaBuilder />}
    </div>
  );
}

export default App;

