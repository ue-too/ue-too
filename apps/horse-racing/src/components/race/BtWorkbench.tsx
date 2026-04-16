import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    ARCHETYPES,
    BT_ARCHETYPE_IDS,
    BUILTIN_ARCHETYPE_NAMES,
    DEFAULT_CONFIG,
    type BTConfig,
    registerArchetype,
    removeArchetype,
} from '@/ai/bt-jockey';
import type { V2SimHandle } from '@/simulation';

export const WORKBENCH_BT_URL = 'bt://~workbench';

type KnobKey = keyof BTConfig;

const KNOB_META: { key: KnobKey; label: string; min: number; max: number; step: number }[] = [
    { key: 'cruiseLow', label: 'Cruise low', min: 0.2, max: 0.9, step: 0.01 },
    { key: 'cruiseHigh', label: 'Cruise high', min: 0.25, max: 0.95, step: 0.01 },
    { key: 'targetLane', label: 'Target lane', min: -0.95, max: 0.0, step: 0.01 },
    { key: 'lateralAggression', label: 'Lateral aggression', min: 0.1, max: 1.0, step: 0.05 },
    { key: 'kickPhase', label: 'Kick phase', min: 0.5, max: 0.96, step: 0.01 },
    { key: 'kickEarlyMargin', label: 'Kick early margin', min: 0, max: 0.2, step: 0.01 },
    { key: 'kickLateCap', label: 'Kick late cap', min: 0.8, max: 0.98, step: 0.01 },
    { key: 'wPass', label: 'w_pass', min: 0, max: 3, step: 0.05 },
    { key: 'wKick', label: 'w_kick', min: 0, max: 3, step: 0.05 },
    { key: 'wDraft', label: 'w_draft', min: 0, max: 3, step: 0.05 },
    { key: 'blockProgressMax', label: 'Block progress max', min: 0, max: 0.1, step: 0.005 },
    { key: 'blockLateralTol', label: 'Block lateral tol', min: 0, max: 0.5, step: 0.01 },
    { key: 'blockMinSlowness', label: 'Block min slowness', min: 0, max: 0.1, step: 0.005 },
    { key: 'conserveThreshold', label: 'Conserve threshold', min: 0, max: 0.6, step: 0.05 },
    { key: 'passMinTicks', label: 'Pass min ticks', min: 10, max: 120, step: 5 },
    { key: 'passClearLateral', label: 'Pass clear lateral', min: 0.05, max: 0.5, step: 0.05 },
    { key: 'passCooldownTicks', label: 'Pass cooldown', min: 10, max: 300, step: 10 },
    { key: 'settleTicks', label: 'Settle ticks', min: 10, max: 120, step: 5 },
    { key: 'transitionMinTicks', label: 'Transition min ticks', min: 5, max: 100, step: 5 },
    { key: 'defendOnScore', label: 'Defend on score', min: 0.1, max: 1.5, step: 0.05 },
    { key: 'defendOffScore', label: 'Defend off score', min: 0.05, max: 1.0, step: 0.05 },
    { key: 'defendTangMin', label: 'Defend tang min', min: 0.1, max: 1.0, step: 0.05 },
    { key: 'defendDrift', label: 'Defend drift', min: 0, max: 0.5, step: 0.01 },
    { key: 'offLanePenaltyStart', label: 'Off-lane pen start', min: 0, max: 0.2, step: 0.005 },
    { key: 'offLaneTangPenaltyScale', label: 'Off-lane pen scale', min: 0, max: 1.5, step: 0.05 },
    { key: 'offLaneTangPenaltyMax', label: 'Off-lane pen max', min: 0, max: 0.4, step: 0.01 },
    { key: 'offLaneDecelScale', label: 'Off-lane decel scale', min: 0.3, max: 2.0, step: 0.05 },
    { key: 'offLaneAccelRelief', label: 'Off-lane accel relief', min: 0, max: 0.2, step: 0.01 },
];

function resolvedConfig(base: string, custom: Partial<BTConfig>): BTConfig {
    const archDefaults = ARCHETYPES[base] ?? {};
    return { ...DEFAULT_CONFIG, ...archDefaults, ...custom };
}

interface Props {
    sim: V2SimHandle;
    onClose: () => void;
    onConfigChange?: () => void;
}

export function BtWorkbench({ sim, onClose, onConfigChange }: Props): ReactNode {
    const [baseArchetype, setBaseArchetype] = useState('stalker');
    const [customOverrides, setCustomOverrides] = useState<Partial<BTConfig>>({});
    const [newName, setNewName] = useState('');
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    const [archetypeList, setArchetypeList] = useState(() => [...BT_ARCHETYPE_IDS]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const merged = useMemo(
        () => resolvedConfig(baseArchetype, customOverrides),
        [baseArchetype, customOverrides]
    );

    useEffect(() => {
        registerArchetype('~workbench', merged);
        setArchetypeList([...BT_ARCHETYPE_IDS]);
        sim.invalidateJockeyUrl(WORKBENCH_BT_URL);
        onConfigChange?.();
    }, [merged, sim, onConfigChange]);

    const setKnob = useCallback((key: KnobKey, value: number) => {
        setCustomOverrides(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetToArchetype = useCallback(() => {
        setCustomOverrides({});
    }, []);

    const exportConfig = useCallback(() => {
        const diffOnly: Partial<BTConfig> = {};
        for (const { key } of KNOB_META) {
            if (merged[key] !== DEFAULT_CONFIG[key]) {
                (diffOnly as Record<string, number>)[key] = merged[key];
            }
        }
        const blob = new Blob(
            [JSON.stringify({ base: baseArchetype, overrides: diffOnly, resolved: merged }, null, 2)],
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bt-config-${baseArchetype}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [baseArchetype, merged]);

    const importConfig = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const json = JSON.parse(reader.result as string);
                    if (json.base && typeof json.base === 'string') {
                        if (json.base in ARCHETYPES) {
                            setBaseArchetype(json.base);
                        } else {
                            const overrides = json.overrides ?? json.resolved ?? {};
                            registerArchetype(json.base, overrides);
                            setArchetypeList([...BT_ARCHETYPE_IDS]);
                            setBaseArchetype(json.base);
                            setCustomOverrides({});
                            setSaveMsg(`Imported and registered "${json.base}" as a new archetype.`);
                            return;
                        }
                    }
                    if (json.overrides && typeof json.overrides === 'object') {
                        setCustomOverrides(json.overrides);
                    } else if (json.resolved && typeof json.resolved === 'object') {
                        setCustomOverrides(json.resolved);
                    }
                } catch {
                    /* ignore bad json */
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        },
        []
    );

    const saveAsArchetype = useCallback(() => {
        const name = newName.trim().toLowerCase().replace(/\s+/g, '-');
        if (!name) {
            setSaveMsg('Name cannot be empty.');
            return;
        }
        if (BUILTIN_ARCHETYPE_NAMES.has(name)) {
            setSaveMsg(`"${name}" is a built-in archetype and cannot be overwritten.`);
            return;
        }
        const diffOnly: Partial<BTConfig> = {};
        for (const { key } of KNOB_META) {
            if (merged[key] !== DEFAULT_CONFIG[key]) {
                (diffOnly as Record<string, number>)[key] = merged[key];
            }
        }
        registerArchetype(name, diffOnly);
        setArchetypeList([...BT_ARCHETYPE_IDS]);
        setBaseArchetype(name);
        setCustomOverrides({});
        setNewName('');
        setSaveMsg(`Saved "${name}" — it's now available in horse pickers.`);
    }, [newName, merged]);

    const deleteArchetype = useCallback(() => {
        if (BUILTIN_ARCHETYPE_NAMES.has(baseArchetype)) {
            setSaveMsg(`Cannot delete built-in archetype "${baseArchetype}".`);
            return;
        }
        removeArchetype(baseArchetype);
        setArchetypeList([...BT_ARCHETYPE_IDS]);
        setBaseArchetype(BT_ARCHETYPE_IDS[0] ?? 'stalker');
        setCustomOverrides({});
        setSaveMsg(`Deleted "${baseArchetype}".`);
    }, [baseArchetype]);

    return (
        <div
            style={{
                position: 'absolute',
                top: 56,
                left: 16,
                width: 370,
                maxHeight: 'min(82vh, 800px)',
                overflow: 'auto',
                zIndex: 45,
                pointerEvents: 'auto',
                background: 'rgba(18,18,18,0.96)',
                border: '1px solid #444',
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
                color: '#eee',
                fontSize: 13,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                }}
            >
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                    BT Workbench
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    style={smallBtn}
                >
                    Close
                </button>
            </div>

            <p style={{ fontSize: 11, color: '#999', marginBottom: 10, lineHeight: 1.4 }}>
                Tweak knobs here — the live config is available as{' '}
                <strong>BT · ~workbench</strong> in the horse picker.
                Assign it to any horse, then start the race normally.
            </p>

            {/* Base archetype */}
            <label style={lblStyle}>Base archetype</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <select
                    value={baseArchetype}
                    onChange={e => {
                        setBaseArchetype(e.target.value);
                        setCustomOverrides({});
                        setSaveMsg(null);
                    }}
                    style={{ ...inpStyle, flex: 1 }}
                >
                    {archetypeList.map(id => (
                        <option key={id} value={id}>
                            {id}
                            {!BUILTIN_ARCHETYPE_NAMES.has(id) ? ' (custom)' : ''}
                        </option>
                    ))}
                </select>
                {!BUILTIN_ARCHETYPE_NAMES.has(baseArchetype) && (
                    <button
                        type="button"
                        onClick={deleteArchetype}
                        style={{ ...smallBtn, color: '#f87171', borderColor: '#7f1d1d' }}
                        title="Delete this custom archetype"
                    >
                        Delete
                    </button>
                )}
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 6,
                    marginBottom: 12,
                    flexWrap: 'wrap',
                }}
            >
                <button type="button" onClick={resetToArchetype} style={smallBtn}>
                    Reset to base
                </button>
                <button type="button" onClick={exportConfig} style={smallBtn}>
                    Export JSON
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={smallBtn}
                >
                    Import JSON
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={importConfig}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Save as new archetype */}
            <div style={{ marginBottom: 12 }}>
                <label style={lblStyle}>Save as new archetype</label>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        placeholder="my-custom-closer"
                        value={newName}
                        onChange={e => {
                            setNewName(e.target.value);
                            setSaveMsg(null);
                        }}
                        style={{ ...inpStyle, flex: 1, fontSize: 12 }}
                    />
                    <button
                        type="button"
                        onClick={saveAsArchetype}
                        style={{
                            ...smallBtn,
                            background: '#1a5c2a',
                            borderColor: '#2d8a4e',
                            color: '#4ade80',
                        }}
                    >
                        Save
                    </button>
                </div>
                {saveMsg && (
                    <div
                        style={{
                            fontSize: 11,
                            marginTop: 4,
                            color: saveMsg.startsWith('Saved') || saveMsg.startsWith('Deleted')
                                ? '#4ade80'
                                : '#f87171',
                        }}
                    >
                        {saveMsg}
                    </div>
                )}
            </div>

            {/* Knob sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {KNOB_META.map(({ key, label, min, max, step }) => (
                    <div key={key}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11,
                                color: '#aaa',
                                marginBottom: 2,
                            }}
                        >
                            <span>{label}</span>
                            <span style={{ fontFamily: 'monospace' }}>
                                {merged[key].toFixed(
                                    step < 0.01 ? 3 : step < 0.1 ? 2 : 1
                                )}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={merged[key]}
                            onChange={e => setKnob(key, parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: '#4a9eff' }}
                        />
                    </div>
                ))}
            </div>

        </div>
    );
}

const smallBtn: React.CSSProperties = {
    border: '1px solid #555',
    background: '#333',
    color: '#ccc',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 12,
};

const lblStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#bbb',
    display: 'block',
    marginBottom: 4,
};

const inpStyle: React.CSSProperties = {
    background: '#2a2a2a',
    border: '1px solid #555',
    borderRadius: 6,
    color: 'white',
    padding: '6px 8px',
    fontSize: 13,
};
