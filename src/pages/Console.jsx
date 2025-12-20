// src/pages/Console.jsx
import { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { executeCommand } from '../services/cliService';
import useAppStore from '../store/useAppStore';

const HELP_TEXT = `
╔══════════════════════════════════════════════════════╗
║          SplitTrack Console - Commands               ║
╠══════════════════════════════════════════════════════╣
║  TRANSACTIONS:                                       ║
║    amt:100 expn:Lunch c:Food                         ║
║    amt:500 split:dynamic g:Trip                      ║
║                                                      ║
║  MANAGEMENT:                                         ║
║    ls [n]   - Show last n transactions               ║
║    undo     - Delete your last transaction           ║
║    stats    - Show this month's spending             ║
║    clear    - Clear screen                           ║
║    help     - Show this help                         ║
║                                                      ║
║  ALIASES:                                            ║
║    amt/a        = amount                             ║
║    expn/name/n  = expense name                       ║
║    c/cat        = category                           ║
║    p/plc        = place                              ║
║    m/mode/pay   = payment mode                       ║
║    g/grp        = group                              ║
║    dt/date      = date (dd/mm/yyyy)                  ║
║    by/paid      = payer (by:John or by:me)           ║
║    inc          = include me (inc:yes / inc:no)      ║
║    sm/split     = split method (equal/dynamic/%)     ║
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
    const [session, setSession] = useState(null); // NEW: Interactive session state
    const inputRef = useRef(null);
    const { participants } = useAppStore();

    const getName = (uid) => {
        if (uid === 'me') return 'You';
        const p = participants.find(p => p.uniqueId === uid);
        return p ? p.name : uid;
    };

    const handleSubmit = async () => {
        if (!input.trim()) return;
        const rawInput = input.trim();

        // Add to history (avoid duplicates of last command)
        if (commandHistory[0] !== rawInput) {
            setCommandHistory(prev => [rawInput, ...prev].slice(0, 50));
        }
        setHistoryIndex(-1);
        setInput('');
        setShowWelcome(false);

        // --- BLOCK 1: HANDLE INTERACTIVE SESSION ---
        if (session) {
            handleInteractiveInput(rawInput);
            return;
        }

        // --- BLOCK 2: STANDARD COMMANDS ---
        if (rawInput.toLowerCase() === 'clear') {
            setLastCommand(null);
            setLastOutput(null);
            setShowWelcome(true);
            return;
        }

        if (rawInput.toLowerCase() === 'help') {
            setLastCommand(rawInput);
            setLastOutput({ success: true, message: HELP_TEXT, isHelp: true });
            return;
        }

        // Execute regular command
        setLastCommand(rawInput);
        const res = await executeCommand(rawInput);

        // Check if we need to start an interaction
        if (res.requiresInteraction) {
            setSession({
                step: 0,
                accumulatedSplits: {},
                draftTxn: res.draftTxn,
                people: res.peopleToAsk,
                method: res.method
            });

            const firstPerson = getName(res.peopleToAsk[0]);
            const label = res.method === 'percentage' ? '%' : '₹';

            setLastOutput({
                success: true,
                message: `⚠️ ${res.method.toUpperCase()} SPLIT\nTotal: ₹${res.draftTxn.amount / 100}\n\nEnter share for [${firstPerson}] in ${label}:`
            });
        } else {
            setLastOutput(res);
        }
    };

    const handleInteractiveInput = async (val) => {
        const numericVal = parseFloat(val);
        if (isNaN(numericVal)) {
            setLastOutput({ success: false, message: "❌ Invalid number. Try again." });
            return;
        }

        const currentId = session.people[session.step];
        const newSplits = { ...session.accumulatedSplits, [currentId]: numericVal };
        const nextStep = session.step + 1;

        if (nextStep < session.people.length) {
            // Ask next person
            const nextPerson = getName(session.people[nextStep]);

            // Calculate remaining info for display
            let info = '';
            if (session.method === 'dynamic') {
                const currentSum = Object.values(newSplits).reduce((a, b) => a + b, 0);
                const remaining = (session.draftTxn.amount / 100) - currentSum;
                info = ` (Remaining: ₹${remaining.toFixed(2)})`;
            } else if (session.method === 'percentage') {
                const currentSum = Object.values(newSplits).reduce((a, b) => a + b, 0);
                info = ` (${currentSum}% allocated)`;
            }

            setSession({ ...session, step: nextStep, accumulatedSplits: newSplits });
            setLastCommand(`${getName(currentId)}: ${val}`);
            setLastOutput({
                success: true,
                message: `✓ Saved. Next: [${nextPerson}]${info}\nEnter share:`
            });
        } else {
            // All inputs done -> Validate
            let isValid = false;
            const finalSplits = {};
            const totalAmount = session.draftTxn.amount; // Paise

            if (session.method === 'dynamic') {
                const sumRupees = Object.values(newSplits).reduce((a, b) => a + b, 0);
                const sumPaise = Math.round(sumRupees * 100);

                if (Math.abs(sumPaise - totalAmount) < 5) { // Allow ₹0.05 tolerance
                    isValid = true;
                    Object.keys(newSplits).forEach(k => finalSplits[k] = Math.round(newSplits[k] * 100));
                } else {
                    setLastOutput({
                        success: false,
                        message: `❌ Mismatch! Entered: ₹${sumRupees}, Actual: ₹${totalAmount / 100}.\nRestarting inputs...`
                    });
                    const firstPerson = getName(session.people[0]);
                    setSession({ ...session, step: 0, accumulatedSplits: {} });
                    setTimeout(() => {
                        setLastOutput({ success: true, message: `Enter share for [${firstPerson}] in ₹:` });
                    }, 1500);
                    return;
                }
            } else if (session.method === 'percentage') {
                const sumPercent = Object.values(newSplits).reduce((a, b) => a + b, 0);
                if (Math.abs(sumPercent - 100) < 0.5) { // Allow 0.5% tolerance
                    isValid = true;
                    // Calculate shares from percentages
                    Object.keys(newSplits).forEach(k => {
                        finalSplits[k] = Math.round((newSplits[k] / 100) * totalAmount);
                    });
                    // Fix rounding on 'me' or first person
                    const calcTotal = Object.values(finalSplits).reduce((a, b) => a + b, 0);
                    const diff = totalAmount - calcTotal;
                    if (diff !== 0) {
                        const firstKey = Object.keys(finalSplits)[0];
                        finalSplits[firstKey] = (finalSplits[firstKey] || 0) + diff;
                    }
                } else {
                    setLastOutput({ success: false, message: `❌ Total is ${sumPercent}% (Must be 100%). Restarting...` });
                    const firstPerson = getName(session.people[0]);
                    setSession({ ...session, step: 0, accumulatedSplits: {} });
                    setTimeout(() => {
                        setLastOutput({ success: true, message: `Enter share for [${firstPerson}] in %:` });
                    }, 1500);
                    return;
                }
            }

            if (isValid) {
                const finalTxn = { ...session.draftTxn, splits: finalSplits, splitMethod: session.method };
                const res = await executeCommand(null, finalTxn); // Commit with interactiveData
                setSession(null);
                setLastCommand("Splits Finalized");
                setLastOutput(res);
            }
        }
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
                        <div className="text-green-400 font-bold mb-2">SplitTrack Terminal v2.1</div>
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
                                        <code className={`text-xs md:text-sm whitespace-pre-wrap ${lastOutput.success ? 'text-green-400' : 'text-red-400'}`}>
                                            {lastOutput.message}
                                        </code>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Interactive Session Indicator */}
                {session && (
                    <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-xs">
                        📝 Interactive Mode: {session.method.toUpperCase()} split ({session.step + 1}/{session.people.length})
                    </div>
                )}
            </div>

            {/* Input Area - Responsive */}
            <div className="flex items-center gap-2 border-t border-gray-700 pt-3">
                <span className="text-yellow-500 font-bold shrink-0">{session ? '>' : '$'}</span>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 md:py-2.5 text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                    placeholder={session ? "Enter amount..." : "amt:100 expn:Lunch c:Food..."}
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


