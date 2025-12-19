// src/pages/Console.jsx
import { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { executeCommand } from '../services/cliService';

const HELP_TEXT = `
╔══════════════════════════════════════════════════════╗
║          SplitTrack Console - Commands               ║
╠══════════════════════════════════════════════════════╣
║  QUICK ADD (Legacy):                                 ║
║    exp <amount> <name> [category]                    ║
║    split <amount> <@who> <name>                      ║
║                                                      ║
║  KEY:VALUE SYNTAX:                                   ║
║    amt:100 expn:Lunch c:Food                         ║
║    amt:50 expn:Coffee cat:Beverages dt:yesterday     ║
║                                                      ║
║  ALIASES:                                            ║
║    a/amt        = amount                             ║
║    expn/name/n  = expense name                       ║
║    d/desc/note  = description                        ║
║    c/cat        = category                           ║
║    p/plc        = place                              ║
║    m/mode/pay   = payment mode                       ║
║    g/grp        = group                              ║
║    dt/date      = date                               ║
║    tag          = tag                                ║
║                                                      ║
║  SPECIAL:                                            ║
║    help   - Show this help                           ║
║    clear  - Clear console                            ║
║                                                      ║
║  NAVIGATION:                                         ║
║    ↑/↓     - Browse command history                  ║
╚══════════════════════════════════════════════════════╝
`.trim();

const Console = () => {
    const [input, setInput] = useState('');
    const [lastCommand, setLastCommand] = useState(null);
    const [lastOutput, setLastOutput] = useState(null);
    const [showWelcome, setShowWelcome] = useState(true);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const inputRef = useRef(null);

    const handleSubmit = async () => {
        if (!input.trim()) return;
        const cmd = input.trim();

        // Add to history (avoid duplicates of last command)
        if (commandHistory[0] !== cmd) {
            setCommandHistory(prev => [cmd, ...prev].slice(0, 50)); // Keep last 50 commands
        }
        setHistoryIndex(-1);

        setInput('');
        setShowWelcome(false);

        // Handle special commands
        if (cmd.toLowerCase() === 'clear') {
            setLastCommand(null);
            setLastOutput(null);
            setShowWelcome(true);
            return;
        }

        if (cmd.toLowerCase() === 'help') {
            setLastCommand(cmd);
            setLastOutput({ success: true, message: HELP_TEXT, isHelp: true });
            return;
        }

        // Execute regular command
        setLastCommand(cmd);
        const res = await executeCommand(cmd);
        setLastOutput(res);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    return (
        <div
            className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] bg-gray-900 text-green-400 font-mono p-3 md:p-4 overflow-hidden pb-20 md:pb-4"
            onClick={() => inputRef.current?.focus()}
        >
            {/* Output Area */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 scrollbar-hide">
                {showWelcome && !lastCommand && (
                    <div className="text-gray-500">
                        <div className="text-green-400 font-bold mb-2">SplitTrack Terminal v2.0</div>
                        <div>Type <span className="text-yellow-400">"help"</span> for commands.</div>
                        <div className="text-xs mt-1">Use <span className="text-yellow-400">↑</span>/<span className="text-yellow-400">↓</span> arrows to browse history.</div>
                    </div>
                )}

                {lastCommand && (
                    <div className="space-y-2">
                        {/* Command */}
                        <div className="text-gray-400">
                            <span className="text-yellow-500">$ </span>
                            <span className="text-white">{lastCommand}</span>
                        </div>

                        {/* Output */}
                        {lastOutput && (
                            <div className={`${lastOutput.isHelp ? 'whitespace-pre text-xs md:text-sm text-cyan-400' : ''}`}>
                                {lastOutput.isHelp ? (
                                    <pre className="overflow-x-auto">{lastOutput.message}</pre>
                                ) : (
                                    <div className={`p-3 rounded-lg ${lastOutput.success ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                                        <code className={`text-xs md:text-sm ${lastOutput.success ? 'text-green-400' : 'text-red-400'}`}>
                                            {JSON.stringify({ success: lastOutput.success, message: lastOutput.message }, null, 2)}
                                        </code>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input Area - Responsive */}
            <div className="flex items-center gap-2 border-t border-gray-700 pt-3">
                <span className="text-yellow-500 font-bold shrink-0">$</span>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 md:py-2.5 text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="amt:100 d:Lunch c:Food..."
                    autoFocus
                />
                <button
                    onClick={handleSubmit}
                    className="shrink-0 h-10 w-10 md:h-11 md:w-11 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center justify-center transition-colors active:scale-95"
                    aria-label="Submit Command"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

export default Console;

