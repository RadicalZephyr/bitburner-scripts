import { NS } from 'netscript';

import { LogDisplay } from 'ui/LogDisplay';
import { LogMode, LogToolbar } from 'ui/LogToolbar';

import { RingBuffer } from 'util/ring-buffer';

export interface LogRootProps {
    ns: NS;
    buffer: RingBuffer<string>;
    children: React.ReactNode;
}

export function LogRoot({ ns, buffer, children }: LogRootProps) {
    const [mode, setMode] = React.useState<LogMode>('custom');

    // Corner toolbar; always visible
    return (
        <div className="bb-log-root">
            <LogToolbar ns={ns} mode={mode} onChange={setMode} />

            {mode === 'custom' && (
                <div className="bb-custom-view">{children}</div>
            )}

            {mode === 'logs' && (
                <div className="bb-logs-view">
                    <LogDisplay ns={ns} lines={buffer} /* +filters */ />
                </div>
            )}

            {mode === 'split' && (
                <Split
                    left={<div className="bb-custom-view">{children}</div>}
                    right={
                        <div className="bb-logs-view">
                            <LogDisplay ns={ns} lines={buffer} />
                        </div>
                    }
                />
            )}
        </div>
    );
}

interface SplitProps {
    left: React.ReactNode;
    right: React.ReactNode;
}

function Split({ left, right }: SplitProps) {
    return (
        <div style={{ display: 'flex', gap: '1em' }}>
            {left}
            {right}
        </div>
    );
}
