import React, { useState, useEffect } from 'react';

const NumberInput = ({ value, onChange, placeholder, className, autoFocus }) => {
    // Store as string to allow intermediate states (like empty string or decimal point)
    const [textValue, setTextValue] = useState(value?.toString() || '');

    useEffect(() => {
        // Sync with external value changes
        if (value !== undefined && value !== null) {
            setTextValue(value.toString());
        }
    }, [value]);

    const handleChange = (e) => {
        const val = e.target.value;

        // Regex to allow digits and at most one decimal point
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setTextValue(val);
            onChange({ target: { value: val } });
        }
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            value={textValue}
            onChange={handleChange}
            placeholder={placeholder}
            className={className}
            autoFocus={autoFocus}
        />
    );
};

export default NumberInput;
