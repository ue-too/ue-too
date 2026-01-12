import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createStateMachineFromSchema, StateMachineSchema, BaseContext, StateMachine } from '@ue-too/being';

interface State {
  name: string;
  transitions: Transition[];
  onEnter?: string;
  onExit?: string;
}

interface Transition {
  event: string;
  targetState: string;
  action?: string;
  guards?: Guard[];
}

interface Guard {
  condition: string;
  targetState: string;
}

interface EventDef {
  name: string;
  payload: Record<string, string | undefined>;
}

interface ContextField {
  id: number;
  name: string;
  type: string;
  defaultValue: string;
}

// Example templates
const examples = {
  timer: {
    name: 'Timer (IDLE, RUNNING, PAUSED)',
    contextFields: [
      { id: 1, name: 'elapsed', type: 'number', defaultValue: '0' },
      { id: 2, name: 'startTime', type: 'number', defaultValue: '0' },
      { id: 3, name: 'pausedTime', type: 'number', defaultValue: '0' },
    ],
    events: [
      { name: 'start', payload: {} },
      { name: 'stop', payload: {} },
      { name: 'pause', payload: {} },
      { name: 'resume', payload: {} },
      { name: 'tick', payload: { delta: 'number' } },
    ],
    states: [
      {
        name: 'IDLE',
        transitions: [
          {
            event: 'start',
            targetState: 'RUNNING',
            action: 'console.log("Timer started"); context.startTime = Date.now(); context.elapsed = 0;',
          },
        ],
        onEnter: 'console.log("Entered IDLE state");',
      },
      {
        name: 'RUNNING',
        transitions: [
          {
            event: 'stop',
            targetState: 'IDLE',
            action: 'console.log(`Timer stopped. Elapsed: ${context.elapsed}ms`);',
          },
          {
            event: 'pause',
            targetState: 'PAUSED',
            action: 'console.log("Timer paused"); context.pausedTime = Date.now();',
          },
          {
            event: 'tick',
            targetState: 'RUNNING',
            action: 'context.elapsed += payload.delta;',
          },
        ],
        onEnter: 'console.log("Entered RUNNING state");',
        onExit: 'console.log("Exiting RUNNING state");',
      },
      {
        name: 'PAUSED',
        transitions: [
          {
            event: 'resume',
            targetState: 'RUNNING',
            action: 'const pauseDuration = Date.now() - context.pausedTime; console.log(`Resumed after ${pauseDuration}ms pause`);',
          },
          {
            event: 'stop',
            targetState: 'IDLE',
            action: 'console.log(`Timer stopped from paused state. Total elapsed: ${context.elapsed}ms`);',
          },
        ],
        onEnter: 'console.log("Entered PAUSED state");',
      },
    ],
    initialState: 'IDLE',
  },
  vending: {
    name: 'Vending Machine',
    contextFields: [
      { id: 1, name: 'balance', type: 'number', defaultValue: '0' },
      { id: 2, name: 'selectedItem', type: 'string', defaultValue: 'null' },
      { id: 3, name: 'itemPrice', type: 'number', defaultValue: '0' },
    ],
    events: [
      { name: 'insertBill', payload: {} },
      { name: 'selectCoke', payload: {} },
      { name: 'selectRedBull', payload: {} },
      { name: 'selectWater', payload: {} },
      { name: 'cancel', payload: {} },
    ],
    states: [
      {
        name: 'IDLE',
        transitions: [
          {
            event: 'insertBill',
            targetState: 'ONE_DOLLAR',
            action: 'context.balance = 1; console.log("Inserted $1. Balance: $1");',
          },
        ],
      },
      {
        name: 'ONE_DOLLAR',
        transitions: [
          {
            event: 'insertBill',
            targetState: 'TWO_DOLLARS',
            action: 'context.balance = 2; console.log("Inserted $1. Balance: $2");',
          },
          {
            event: 'selectCoke',
            targetState: 'IDLE',
            action: 'console.log("Dispensing Coke. Thank you!"); context.balance = 0;',
          },
          {
            event: 'selectRedBull',
            targetState: 'ONE_DOLLAR',
            action: 'console.log("Not enough money. Need $2, have $1");',
          },
          {
            event: 'cancel',
            targetState: 'IDLE',
            action: 'console.log("Cancelled. Refunding $1"); context.balance = 0;',
          },
        ],
      },
      {
        name: 'TWO_DOLLARS',
        transitions: [
          {
            event: 'insertBill',
            targetState: 'THREE_DOLLARS',
            action: 'context.balance = 3; console.log("Inserted $1. Balance: $3");',
          },
          {
            event: 'selectCoke',
            targetState: 'IDLE',
            action: 'console.log("Dispensing Coke. Change: $1"); context.balance = 0;',
          },
          {
            event: 'selectRedBull',
            targetState: 'IDLE',
            action: 'console.log("Dispensing Red Bull. Thank you!"); context.balance = 0;',
          },
          {
            event: 'selectWater',
            targetState: 'TWO_DOLLARS',
            action: 'console.log("Not enough money. Need $3, have $2");',
          },
          {
            event: 'cancel',
            targetState: 'IDLE',
            action: 'console.log("Cancelled. Refunding $2"); context.balance = 0;',
          },
        ],
      },
      {
        name: 'THREE_DOLLARS',
        transitions: [
          {
            event: 'selectCoke',
            targetState: 'IDLE',
            action: 'console.log("Dispensing Coke. Change: $2"); context.balance = 0;',
          },
          {
            event: 'selectRedBull',
            targetState: 'IDLE',
            action: 'console.log("Dispensing Red Bull. Change: $1"); context.balance = 0;',
          },
          {
            event: 'selectWater',
            targetState: 'IDLE',
            action: 'console.log("Dispensing Water. Thank you!"); context.balance = 0;',
          },
          {
            event: 'cancel',
            targetState: 'IDLE',
            action: 'console.log("Cancelled. Refunding $3"); context.balance = 0;',
          },
        ],
      },
    ],
    initialState: 'IDLE',
  },
  payment: {
    name: 'Payment Machine (with Guards)',
    contextFields: [
      { id: 1, name: 'balance', type: 'number', defaultValue: '0' },
      { id: 2, name: 'itemPrice', type: 'number', defaultValue: '0' },
      { id: 3, name: 'hasDiscount', type: 'boolean', defaultValue: 'false' },
    ],
    events: [
      { name: 'selectItem', payload: { price: 'number' } },
      { name: 'applyDiscount', payload: {} },
      { name: 'pay', payload: { amount: 'number' } },
      { name: 'confirm', payload: {} },
    ],
    states: [
      {
        name: 'SELECTING',
        transitions: [
          {
            event: 'selectItem',
            targetState: 'PAYING',
            action: 'context.itemPrice = payload.price || 0; console.log(`Selected item. Price: $${context.itemPrice}`);',
          },
        ],
      },
      {
        name: 'PAYING',
        transitions: [
          {
            event: 'applyDiscount',
            targetState: 'PAYING',
            action: 'context.hasDiscount = true; context.itemPrice *= 0.9; console.log(`Discount applied. New price: $${context.itemPrice.toFixed(2)}`);',
          },
          {
            event: 'pay',
            targetState: 'SELECTING',
            action: 'const amount = payload.amount || 0; context.balance += amount; console.log(`Paid $${amount}. Balance: $${context.balance}`);',
            guards: [
              {
                condition: 'context.balance >= context.itemPrice',
                targetState: 'CONFIRMED',
              },
              {
                condition: 'context.balance < context.itemPrice',
                targetState: 'PAYING',
              },
            ],
          },
        ],
      },
      {
        name: 'CONFIRMED',
        transitions: [
          {
            event: 'confirm',
            targetState: 'SELECTING',
            action: 'const change = context.balance - context.itemPrice; console.log(`Payment confirmed! Change: $${change.toFixed(2)}`); context.balance = 0; context.itemPrice = 0; context.hasDiscount = false;',
          },
        ],
      },
    ],
    initialState: 'SELECTING',
  },
  calculator: {
    name: 'Calculator (with Outputs)',
    contextFields: [
      { id: 1, name: 'value', type: 'number', defaultValue: '0' },
      { id: 2, name: 'history', type: 'array_number', defaultValue: '[]' },
    ],
    events: [
      { name: 'add', payload: { amount: 'number' } },
      { name: 'multiply', payload: { factor: 'number' } },
      { name: 'getResult', payload: {} },
      { name: 'reset', payload: {} },
    ],
    states: [
      {
        name: 'READY',
        transitions: [
          {
            event: 'add',
            targetState: 'READY',
            action: 'context.value += payload.amount; context.history.push(context.value); return context.value;',
          },
          {
            event: 'multiply',
            targetState: 'READY',
            action: 'context.value *= payload.factor; context.history.push(context.value); return context.value;',
          },
          {
            event: 'getResult',
            targetState: 'READY',
            action: 'return context.value;',
          },
          {
            event: 'reset',
            targetState: 'READY',
            action: 'context.value = 0; context.history = [];',
          },
        ],
      },
    ],
    initialState: 'READY',
  },
};

export function StateMachineBuilder() {
  const [states, setStates] = useState<State[]>([{ name: 'IDLE', transitions: [] }]);
  const [events, setEvents] = useState<EventDef[]>([{ name: 'start', payload: {} }]);
  const [contextFields, setContextFields] = useState<ContextField[]>([]);
  const [initialState, setInitialState] = useState('IDLE');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [schemaOutput, setSchemaOutput] = useState('');
  const [newContextFieldName, setNewContextFieldName] = useState('');
  const [newContextFieldType, setNewContextFieldType] = useState('number');
  const [newContextFieldDefault, setNewContextFieldDefault] = useState('0');
  const [liveMachine, setLiveMachine] = useState<StateMachine<any, any, any> | null>(null);
  const [currentMachineState, setCurrentMachineState] = useState<string>('');
  const [contextValues, setContextValues] = useState<Record<string, any>>({});
  const contextRef = useRef<any>(null);

  const loadExample = useCallback((exampleKey: keyof typeof examples) => {
    const example = examples[exampleKey];
    if (!example) return;

    // Load context fields
    setContextFields(example.contextFields.map(f => ({ ...f, id: Date.now() + Math.random() })));

    // Load events - convert payload values to strings
    setEvents(example.events.map(e => ({
      name: e.name,
      payload: Object.fromEntries(
        Object.entries(e.payload).map(([key, value]) => [key, String(value)])
      ),
    })));

    // Load states
    setStates(example.states.map(s => ({
      name: s.name,
      transitions: s.transitions.map(t => ({
        event: t.event,
        targetState: t.targetState,
        action: t.action || '',
        guards: (t as any).guards?.map((g: any) => ({
          condition: g.condition,
          targetState: g.targetState,
        })),
      })),
      onEnter: (s as any).onEnter || '',
      onExit: (s as any).onExit || '',
    })));

    // Set initial state
    setInitialState(example.initialState);

    // Clear schema output
    setSchemaOutput('');
    setLiveMachine(null);
  }, []);

  const addState = useCallback(() => {
    const newState = `STATE_${states.length + 1}`;
    setStates([...states, { name: newState, transitions: [] }]);
  }, [states]);

  const updateStateName = useCallback((oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    if (states.some(s => s.name === newName && s.name !== oldName)) {
      alert('State name already exists');
      return;
    }
    const trimmedName = newName.trim();
    // Update state names and all transitions that reference this state
    setStates(states.map(s => ({
      ...s,
      name: s.name === oldName ? trimmedName : s.name,
      transitions: s.transitions.map(t => ({
        ...t,
        targetState: t.targetState === oldName ? trimmedName : t.targetState
      }))
    })));
    // Update initial state if needed
    if (initialState === oldName) {
      setInitialState(trimmedName);
    }
  }, [states, initialState]);

  const removeState = useCallback((stateName: string) => {
    if (states.length === 1) {
      alert('Cannot remove the last state');
      return;
    }
    setStates(states.filter(s => s.name !== stateName));
    // Remove transitions that target this state
    setStates(prevStates => prevStates.map(s => ({
      ...s,
      transitions: s.transitions.filter(t => t.targetState !== stateName)
    })));
    if (initialState === stateName) {
      setInitialState(states.find(s => s.name !== stateName)?.name || states[0].name);
    }
  }, [states, initialState]);

  const addEvent = useCallback(() => {
    const newEvent = `EVENT_${events.length + 1}`;
    setEvents([...events, { name: newEvent, payload: {} }]);
  }, [events]);

  const updateEventName = useCallback((oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    if (events.some(e => e.name === newName && e.name !== oldName)) {
      alert('Event name already exists');
      return;
    }
    setEvents(events.map(e => e.name === oldName ? { ...e, name: newName.trim() } : e));
    // Update all transitions that reference this event
    setStates(states.map(s => ({
      ...s,
      transitions: s.transitions.map(t => t.event === oldName ? { ...t, event: newName.trim() } : t)
    })));
  }, [events, states]);

  const removeEvent = useCallback((eventName: string) => {
    setEvents(events.filter(e => e.name !== eventName));
    // Remove transitions that use this event
    setStates(states.map(s => ({
      ...s,
      transitions: s.transitions.filter(t => t.event !== eventName)
    })));
  }, [events, states]);

  const addTransition = useCallback((stateName: string) => {
    setStates(states.map(s => {
      if (s.name === stateName) {
        return {
          ...s,
          transitions: [...s.transitions, {
            event: events[0]?.name || '',
            targetState: states[0]?.name || '',
            action: '',
          }]
        };
      }
      return s;
    }));
  }, [states, events]);

  const updateTransition = useCallback((stateName: string, index: number, field: keyof Transition, value: any) => {
    setStates(states.map(s => {
      if (s.name === stateName) {
        const newTransitions = [...s.transitions];
        newTransitions[index] = { ...newTransitions[index], [field]: value };
        return { ...s, transitions: newTransitions };
      }
      return s;
    }));
  }, [states]);

  const removeTransition = useCallback((stateName: string, index: number) => {
    setStates(states.map(s => {
      if (s.name === stateName) {
        return {
          ...s,
          transitions: s.transitions.filter((_, i) => i !== index)
        };
      }
      return s;
    }));
  }, [states]);

  const addContextField = useCallback(() => {
    if (!newContextFieldName.trim()) {
      alert('Please enter a field name');
      return;
    }
    if (contextFields.some(f => f.name === newContextFieldName.trim())) {
      alert('Field name already exists');
      return;
    }
    const field: ContextField = {
      id: Date.now(),
      name: newContextFieldName.trim(),
      type: newContextFieldType,
      defaultValue: newContextFieldDefault,
    };
    setContextFields([...contextFields, field]);
    setNewContextFieldName('');
    setNewContextFieldType('number');
    setNewContextFieldDefault('0');
  }, [newContextFieldName, newContextFieldType, newContextFieldDefault, contextFields]);

  const removeContextField = useCallback((id: number) => {
    setContextFields(contextFields.filter(f => f.id !== id));
  }, [contextFields]);

  const updateContextField = useCallback((id: number, field: keyof ContextField, value: string) => {
    if (field === 'name' && value.trim() && contextFields.some(f => f.id !== id && f.name === value.trim())) {
      alert('Field name already exists');
      return;
    }
    setContextFields(contextFields.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
  }, [contextFields]);

  const generateSchema = useCallback(() => {
    try {
      const eventPayloadMapping: Record<string, any> = {};
      events.forEach(event => {
        eventPayloadMapping[event.name] = Object.keys(event.payload).length > 0 
          ? event.payload 
          : {};
      });

      const stateDefinitions = states.map(state => ({
        name: state.name,
        transitions: state.transitions.map(trans => ({
          event: trans.event,
          targetState: trans.targetState,
          action: trans.action 
            ? new Function('context', 'payload', 'stateMachine', trans.action) as any
            : undefined,
          guards: trans.guards?.map(guard => ({
            guard: new Function('context', `return ${guard.condition}`) as any,
            targetState: guard.targetState,
          })),
        })),
        onEnter: state.onEnter 
          ? new Function('context', 'fromState', state.onEnter) as any
          : undefined,
        onExit: state.onExit
          ? new Function('context', 'toState', state.onExit) as any
          : undefined,
      }));

      const schema: StateMachineSchema<any, any> = {
        states: states.map(s => s.name),
        events: eventPayloadMapping,
        initialState,
        stateDefinitions,
      };

      // Create context from schema
      const contextObj: any = {
        setup: () => {
          contextFields.forEach(field => {
            const value = parseDefaultValue(field.type, field.defaultValue);
            contextObj[field.name] = value;
          });
        },
        cleanup: () => {},
      };

      // Initialize context fields
      contextFields.forEach(field => {
        const value = parseDefaultValue(field.type, field.defaultValue);
        contextObj[field.name] = value;
      });

      const machine = createStateMachineFromSchema(schema, contextObj);
      
      // Generate usage code example
      const usageExample = generateUsageExample(schema, contextFields, events);
      
      // Create a serializable version of the schema (functions become placeholders)
      const serializableSchema = {
        states: schema.states,
        events: schema.events,
        initialState: schema.initialState,
        stateDefinitions: schema.stateDefinitions.map(stateDef => ({
          name: stateDef.name,
          transitions: stateDef.transitions.map(trans => ({
            event: trans.event,
            targetState: trans.targetState,
            action: trans.action ? '[Function]' : undefined,
            guards: trans.guards?.map(g => ({
              guard: '[Function]',
              targetState: g.targetState,
            })),
          })),
          onEnter: stateDef.onEnter ? '[Function]' : undefined,
          onExit: stateDef.onExit ? '[Function]' : undefined,
        })),
      };
      
      // Include context schema in output
      const output = {
        schema: serializableSchema,
        context: {
          fields: contextFields.map(f => ({
            name: f.name,
            type: f.type,
            defaultValue: f.defaultValue,
          })),
          interface: generateContextInterface(contextFields),
        },
        usageExample,
        note: 'Note: Functions in the schema (actions, guards, onEnter, onExit) are shown as [Function]. In actual usage, these are real functions created from your definitions.',
      };
      
      setSchemaOutput(JSON.stringify(output, null, 2));
      
      // Also create a live instance for testing
      try {
        const liveContext = { ...contextObj };
        const liveMachineInstance = createStateMachineFromSchema(schema, liveContext);
        contextRef.current = liveContext;
        setLiveMachine(liveMachineInstance);
        setCurrentMachineState((liveMachineInstance as any).currentState);
        updateContextDisplay(liveContext);
      } catch (err: any) {
        console.error('Failed to create live machine:', err);
      }
    } catch (error: any) {
      setSchemaOutput(`Error: ${error.message}`);
    }
  }, [states, events, initialState, contextFields]);

  const updateContextDisplay = useCallback((context: any) => {
    const values: Record<string, any> = {};
    contextFields.forEach(field => {
      values[field.name] = context[field.name];
    });
    setContextValues(values);
  }, [contextFields]);

  const triggerEvent = useCallback((eventName: string) => {
    if (!liveMachine) return;
    
    try {
      const event = events.find(e => e.name === eventName);
      if (!event) return;
      
      // For events with empty payload, call without payload
      const hasPayload = Object.keys(event.payload).length > 0;
      const result = hasPayload 
        ? (liveMachine.happens as any)(eventName, {})
        : (liveMachine.happens as any)(eventName);
      
      // Update state and context display
      setCurrentMachineState((liveMachine as any).currentState);
      if (contextRef.current) {
        updateContextDisplay(contextRef.current);
      }
    } catch (error: any) {
      alert(`Error triggering event: ${error.message}`);
    }
  }, [liveMachine, events, updateContextDisplay]);

  const updateContextValue = useCallback((fieldName: string, value: any) => {
    if (!contextRef.current) return;
    
    try {
      // Parse the value based on field type
      const field = contextFields.find(f => f.name === fieldName);
      if (!field) return;
      
      let parsedValue: any = value;
      switch (field.type) {
        case 'number':
          parsedValue = parseFloat(value) || 0;
          break;
        case 'boolean':
          parsedValue = value === 'true' || value === '1' || value === true;
          break;
        case 'string':
          parsedValue = String(value);
          break;
        case 'array_number':
        case 'array_string':
        case 'array_boolean':
          // For arrays, try to parse as JSON, otherwise treat as single value
          try {
            parsedValue = JSON.parse(value);
          } catch {
            parsedValue = [value];
          }
          break;
      }
      
      contextRef.current[fieldName] = parsedValue;
      updateContextDisplay(contextRef.current);
    } catch (error: any) {
      alert(`Error updating context: ${error.message}`);
    }
  }, [contextFields, updateContextDisplay]);

  const resetMachine = useCallback(() => {
    if (!liveMachine) return;
    try {
      liveMachine.reset();
      setCurrentMachineState((liveMachine as any).currentState);
      if (contextRef.current) {
        updateContextDisplay(contextRef.current);
      }
    } catch (error: any) {
      alert(`Error resetting machine: ${error.message}`);
    }
  }, [liveMachine, updateContextDisplay]);

  const parseDefaultValue = (type: string, defaultValue: string): any => {
    switch (type) {
      case 'number':
        return parseFloat(defaultValue) || 0;
      case 'boolean':
        return defaultValue === 'true' || defaultValue === '1';
      case 'string':
        return defaultValue || '';
      case 'array_number':
        return [];
      case 'array_string':
        return [];
      case 'array_boolean':
        return [];
      default:
        return defaultValue || null;
    }
  };

  const generateContextInterface = (fields: ContextField[]): string => {
    if (fields.length === 0) {
      return 'interface MyContext extends BaseContext {\n  // No custom fields\n}';
    }
    const fieldDefs = fields.map(f => {
      const typeMap: Record<string, string> = {
        'number': 'number',
        'string': 'string',
        'boolean': 'boolean',
        'array_number': 'number[]',
        'array_string': 'string[]',
        'array_boolean': 'boolean[]',
      };
      const tsType = typeMap[f.type] || 'any';
      return `  ${f.name}: ${tsType};`;
    }).join('\n');
    
    return `interface MyContext extends BaseContext {\n${fieldDefs}\n}`;
  };

  const generateUsageExample = (schema: StateMachineSchema<any, any>, fields: ContextField[], events: EventDef[]): string => {
    const contextInit = fields.map(f => {
      const value = parseDefaultValue(f.type, f.defaultValue);
      const displayValue = typeof value === 'string' ? `'${value}'` : 
                          Array.isArray(value) ? '[]' : 
                          String(value);
      return `    ${f.name}: ${displayValue},`;
    }).join('\n');

    const eventExamples = events.map(e => {
      const hasPayload = Object.keys(e.payload).length > 0;
      return `// Trigger ${e.name} event\nmachine.happens("${e.name}"${hasPayload ? ', {}' : ''});`;
    }).join('\n\n');

    return `// Step 1: Import the required functions
import { createStateMachineFromSchema, BaseContext } from '@ue-too/being';

// Step 2: Define your context interface
${generateContextInterface(fields)}

// Step 3: Create a context instance
const context: MyContext = {
${contextInit}
  setup() {
    // Initialize your context fields here
${fields.map(f => `    this.${f.name} = ${parseDefaultValue(f.type, f.defaultValue)};`).join('\n')}
  },
  cleanup() {
    // Cleanup logic here
  }
};

// Step 4: Create the state machine from schema
const machine = createStateMachineFromSchema(schema, context);

// Step 5: Use the state machine
// Access current state
const currentState = (machine as any).currentState;
console.log('Current state:', currentState);

// Access and modify context data
${fields.map(f => `context.${f.name} = ${parseDefaultValue(f.type, f.defaultValue)}; // Modify ${f.name}`).join('\n')}

// Trigger events
${eventExamples}

// Listen to state changes
machine.onStateChange((currentState, nextState) => {
  console.log(\`State changed from \${currentState} to \${nextState}\`);
});

// Reset the machine
machine.reset();`;
  };

  const copySchema = useCallback(() => {
    navigator.clipboard.writeText(schemaOutput);
    alert('Schema copied to clipboard!');
  }, [schemaOutput]);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>State Machine Builder</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.9em', fontWeight: 600 }}>Load Example:</label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                loadExample(e.target.value as keyof typeof examples);
                e.target.value = '';
              }
            }}
            style={{
              padding: '8px 12px',
              fontSize: '0.9em',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
            }}
            defaultValue=""
          >
            <option value="">Select an example...</option>
            {Object.entries(examples).map(([key, example]) => (
              <option key={key} value={key}>
                {example.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Builder Panel */}
        <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
          <h2>Builder</h2>
          
          {/* Context Schema Section */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>Context Schema</h3>
            </div>
            <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '6px', padding: '15px', marginBottom: '15px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Field Name:</label>
                <input
                  type="text"
                  value={newContextFieldName}
                  onChange={(e) => setNewContextFieldName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addContextField()}
                  placeholder="e.g., balance, counter, data"
                  style={{ width: '100%', padding: '6px', fontSize: '0.9em', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Type:</label>
                <select
                  value={newContextFieldType}
                  onChange={(e) => setNewContextFieldType(e.target.value)}
                  style={{ width: '100%', padding: '6px', fontSize: '0.9em', border: '1px solid #d1d5db', borderRadius: '4px' }}
                >
                  <option value="number">Number</option>
                  <option value="string">String</option>
                  <option value="boolean">Boolean</option>
                  <option value="array_number">Number[]</option>
                  <option value="array_string">String[]</option>
                  <option value="array_boolean">Boolean[]</option>
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Default Value:</label>
                <input
                  type="text"
                  value={newContextFieldDefault}
                  onChange={(e) => setNewContextFieldDefault(e.target.value)}
                  placeholder="e.g., 0, '', true, []"
                  style={{ width: '100%', padding: '6px', fontSize: '0.9em', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <button onClick={addContextField} style={{ width: '100%', padding: '8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em' }}>
                + Add Context Field
              </button>
            </div>
            {contextFields.map((field) => {
              const typeMap: Record<string, string> = {
                'number': 'Number',
                'string': 'String',
                'boolean': 'Boolean',
                'array_number': 'Number[]',
                'array_string': 'String[]',
                'array_boolean': 'Boolean[]',
              };
              return (
                <div key={field.id} style={{ background: 'white', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateContextField(field.id, 'name', e.target.value)}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          e.target.value = field.name;
                        }
                      }}
                      style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.9em', fontWeight: 600 }}
                    />
                    <button onClick={() => removeContextField(field.id)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em' }}>
                      Delete
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.75em', display: 'block', marginBottom: '2px', color: '#666' }}>Type:</label>
                      <select
                        value={field.type}
                        onChange={(e) => updateContextField(field.id, 'type', e.target.value)}
                        style={{ width: '100%', padding: '4px', fontSize: '0.85em', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      >
                        <option value="number">Number</option>
                        <option value="string">String</option>
                        <option value="boolean">Boolean</option>
                        <option value="array_number">Number[]</option>
                        <option value="array_string">String[]</option>
                        <option value="array_boolean">Boolean[]</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', display: 'block', marginBottom: '2px', color: '#666' }}>Default:</label>
                      <input
                        type="text"
                        value={field.defaultValue}
                        onChange={(e) => updateContextField(field.id, 'defaultValue', e.target.value)}
                        placeholder="0, '', true"
                        style={{ width: '100%', padding: '4px', fontSize: '0.85em', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {contextFields.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '0.9em' }}>
                No context fields defined. Context will use BaseContext only.
              </div>
            )}
          </div>

          {/* Events Section */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>Events</h3>
              <button onClick={addEvent} style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                + Add Event
              </button>
            </div>
            {events.map((event, idx) => (
              <div key={idx} style={{ background: 'white', padding: '10px', marginBottom: '10px', borderRadius: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={event.name}
                  onChange={(e) => updateEventName(event.name, e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) {
                      e.target.value = event.name;
                    } else if (e.target.value !== event.name) {
                      updateEventName(event.name, e.target.value);
                    }
                  }}
                  style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.9em' }}
                />
                <button onClick={() => removeEvent(event.name)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            ))}
          </div>

          {/* States Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>States</h3>
              <button onClick={addState} style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                + Add State
              </button>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label>Initial State: </label>
              <select value={initialState} onChange={(e) => setInitialState(e.target.value)} style={{ padding: '4px 8px', marginLeft: '8px' }}>
                {states.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {states.map((state, stateIdx) => (
              <div key={stateIdx} style={{ background: 'white', padding: '15px', marginBottom: '15px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="text"
                    value={state.name}
                    onChange={(e) => updateStateName(state.name, e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) {
                        e.target.value = state.name;
                      } else if (e.target.value !== state.name) {
                        updateStateName(state.name, e.target.value);
                      }
                    }}
                    style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1em', fontWeight: 600 }}
                  />
                  <button onClick={() => removeState(state.name)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <button onClick={() => addTransition(state.name)} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em' }}>
                    + Add Transition
                  </button>
                </div>

                {state.transitions.map((trans, transIdx) => (
                  <div key={transIdx} style={{ background: '#f9fafb', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>Event:</label>
                        <select 
                          value={trans.event} 
                          onChange={(e) => updateTransition(state.name, transIdx, 'event', e.target.value)}
                          style={{ width: '100%', padding: '4px' }}
                        >
                          {events.map(e => (
                            <option key={e.name} value={e.name}>{e.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>Target State:</label>
                        <select 
                          value={trans.targetState} 
                          onChange={(e) => updateTransition(state.name, transIdx, 'targetState', e.target.value)}
                          style={{ width: '100%', padding: '4px' }}
                        >
                          {states.map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>Action (JavaScript):</label>
                      <textarea
                        value={trans.action || ''}
                        onChange={(e) => updateTransition(state.name, transIdx, 'action', e.target.value)}
                        placeholder="e.g., console.log('Transitioning'); context.value = 1;"
                        style={{ width: '100%', padding: '6px', fontSize: '0.85em', fontFamily: 'monospace', minHeight: '60px' }}
                      />
                    </div>
                    <button onClick={() => removeTransition(state.name, transIdx)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button onClick={generateSchema} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '20px', fontWeight: '600' }}>
            Generate Schema
          </button>
        </div>

        {/* Output Panel */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', color: '#e2e8f0', maxWidth: '100%', overflow: 'hidden' }}>
          <h2 style={{ color: '#e2e8f0' }}>Schema Output</h2>
          <div style={{ 
            background: '#0f172a', 
            border: '1px solid #334155', 
            borderRadius: '8px', 
            padding: '15px', 
            fontFamily: 'monospace', 
            fontSize: '0.9em', 
            maxHeight: '600px', 
            overflow: 'auto', 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '100%',
            marginBottom: '15px' 
          }}>
            {schemaOutput || 'Click "Generate Schema" to see output'}
          </div>
          <button onClick={copySchema} disabled={!schemaOutput} style={{ width: '100%', padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: schemaOutput ? 'pointer' : 'not-allowed', opacity: schemaOutput ? 1 : 0.5 }}>
            Copy Schema
          </button>
        </div>

        {/* Live Preview Panel */}
        <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '8px', border: '2px solid #fbbf24' }}>
          <h2 style={{ color: '#92400e', marginTop: 0 }}>Live Preview</h2>
          
          {liveMachine ? (
            <>
              {/* Current State */}
              <div style={{ background: 'white', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '5px' }}>Current State:</div>
                <div style={{ fontSize: '1.2em', fontWeight: 600, color: '#92400e' }}>{currentMachineState}</div>
              </div>

              {/* Context Values */}
              {contextFields.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '1em', color: '#92400e', marginBottom: '10px' }}>Context Data</h3>
                  <div style={{ background: 'white', padding: '15px', borderRadius: '6px' }}>
                    {contextFields.map(field => {
                      const value = contextValues[field.name];
                      const displayValue = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '');
                      return (
                        <div key={field.id} style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '4px', fontWeight: 600, color: '#666' }}>
                            {field.name} ({field.type}):
                          </label>
                          <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => updateContextValue(field.name, e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.9em', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            placeholder={`Enter ${field.type} value`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Event Triggers */}
              {events.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '1em', color: '#92400e', marginBottom: '10px' }}>Trigger Events</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {events.map(event => (
                      <button
                        key={event.name}
                        onClick={() => triggerEvent(event.name)}
                        style={{
                          padding: '8px 12px',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9em',
                          fontWeight: 600,
                        }}
                      >
                        → {event.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <button
                onClick={resetMachine}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                  fontWeight: 600,
                }}
              >
                Reset Machine
              </button>

              {/* Usage Instructions */}
              <div style={{ marginTop: '20px', padding: '15px', background: 'white', borderRadius: '6px', fontSize: '0.85em', color: '#666' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: '#92400e' }}>How to Use:</div>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Click "Generate Schema" to create a live instance</li>
                  <li>Modify context values directly in the inputs above</li>
                  <li>Trigger events to see state transitions</li>
                  <li>Watch how context data persists across states</li>
                </ol>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#92400e' }}>
              <div style={{ fontSize: '2em', marginBottom: '10px' }}>⚡</div>
              <div>Click "Generate Schema" to create a live instance</div>
              <div style={{ fontSize: '0.85em', marginTop: '10px', color: '#666' }}>
                You can then interact with the state machine and manipulate context data
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
