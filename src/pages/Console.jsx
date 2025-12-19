// src/pages/Console.jsx
import { useState, useEffect, useRef } from 'react';
import { executeCommand } from '../services/cliService';

const Console = () => {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState(['SplitTrack Terminal v1.0', 'Type "help" for commands.']);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [history]);
    useEffect(() => inputRef.current?.focus(), []);

    const handleKeyDown = async (e) => {
        if (e.key === 'Enter') {
            if (!input.trim()) return;
            const cmd = input;

            setHistory(prev => [...prev, `> ${cmd}`]);
            setInput('');

            if (cmd.toLowerCase() === 'clear') {
                setHistory([]);
                return;
            }

            const res = await executeCommand(cmd);
            const output = JSON.stringify({ success: res.success, message: res.message });
            setHistory(prev => [...prev, output]);
        }
    };

    return (
        <div
            className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-green-400 font-mono p-4 overflow-hidden"
            onClick={() => inputRef.current?.focus()}
        >
            <div className="flex-1 overflow-y-auto space-y-1 mb-2 scrollbar-hide">
                {history.map((line, i) => (
                    <div key={i} className={line.includes('"success":false') ? 'text-red-400' : ''}>{line}</div>
                ))}
                <div ref={bottomRef} />
            </div>
            <div className="flex items-center border-t border-gray-700 pt-3">
                <span className="mr-2 text-yellow-500 font-bold">$</span>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600"
                    placeholder="Enter command..."
                    autoFocus
                />
            </div>
        </div>
    );
};

export default Console;
