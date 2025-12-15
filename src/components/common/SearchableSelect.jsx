import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

const SearchableSelect = ({ label, value, onChange, options = [], placeholder, className, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        setTimeout(() => {
            if (!value) { setQuery(""); } else {
                const selected = options.find(o => o.value === value);
                if (selected) setQuery(selected.label);
            }
        }, 0);
    }, [value, options]);

    const filteredOptions = useMemo(() => {
        if (!options) return [];
        if (!query) return options;
        const lowerQuery = query.toLowerCase();
        const selected = options.find(o => o.value === value);
        if (selected && selected.label.toLowerCase() === lowerQuery) return options;
        return options.filter(opt => opt.label.toLowerCase().includes(lowerQuery));
    }, [query, options, value]);

    const handleSelect = (option) => {
        onChange({ target: { value: option.value, option: option } });
        setQuery(option.label);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                const selected = options.find(o => o.value === value);
                if (selected) setQuery(selected.label); else if (!value) setQuery('');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, value, options]);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder || "Select..."}
                    disabled={disabled}
                    className="block w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                </div>
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div
                                key={opt.value || idx}
                                onClick={() => handleSelect(opt)}
                                className={`px-4 py-2 cursor-pointer text-sm ${opt.className || ''} ${opt.value === value ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-200 font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                            >
                                {opt.label}
                            </div>
                        ))
                    ) : (<div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No matches found</div>)}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
