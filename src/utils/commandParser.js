export const parseCommandString = (input, defaults = {}) => {
    // 1. Initialize with Defaults from Settings (or hardcoded fallbacks)
    const config = {
        type: 'expense',
        amount: 0,
        expenseName: 'Untitled',
        description: '',
        category: defaults.defaultCategory || 'General',
        place: defaults.defaultPlace || '',
        mode: defaults.defaultMode || '',
        modeOfPayment: defaults.defaultMode || '',
        tag: defaults.defaultTag || '',
        date: new Date(),
        payer: 'me',
        group: 'personal',
        splitMethod: 'equal',
        participants: []
    };

    // 2. Define Aliases (Lazy Typing)
    const aliases = {
        't': 'type', 'type': 'type',
        'a': 'amount', 'amt': 'amount',
        // Expense Name aliases
        'expn': 'expenseName', 'name': 'expenseName', 'n': 'expenseName', 'for': 'expenseName',
        // Description aliases  
        'd': 'description', 'desc': 'description', 'note': 'description',
        // Other fields
        'c': 'category', 'cat': 'category',
        'p': 'place', 'plc': 'place',
        'm': 'mode', 'mode': 'mode', 'pay': 'mode', 'mop': 'mode',
        'g': 'group', 'grp': 'group',
        'dt': 'date', 'date': 'date',
        'tag': 'tag',
        'sm': 'splitMethod', 'split': 'splitMethod'
    };

    // 3. Parse "key:value" or "key:'value with spaces'"
    const regex = /([a-zA-Z0-9_]+):("([^"]+)"|([^ ]+))/g;
    let match;
    let hasMatches = false;

    while ((match = regex.exec(input)) !== null) {
        hasMatches = true;
        const key = match[1].toLowerCase();
        const value = match[3] || match[4]; // Quoted or Unquoted value

        if (aliases[key]) {
            const field = aliases[key];
            if (field === 'amount') {
                config[field] = parseFloat(value);
            } else if (field === 'date') {
                // Handle Smart Dates
                if (value.toLowerCase() === 'yesterday') {
                    const d = new Date(); d.setDate(d.getDate() - 1);
                    config.date = d;
                } else if (value.toLowerCase() === 'today') {
                    config.date = new Date();
                } else {
                    config.date = new Date(value);
                }
            } else {
                config[field] = value;
            }
        }
    }

    // 4. Fallback for Legacy Commands (e.g., "exp 50 Lunch")
    if (!hasMatches) {
        const parts = input.trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();

        if (['exp', 'add', 'a'].includes(cmd)) {
            config.type = 'expense';
            if (parts[1]) config.amount = parseFloat(parts[1]);
            if (parts[2]) config.expenseName = parts[2].replace(/_/g, ' ');
            // Note: We don't overwrite category here to let the Default stick unless explicitly provided
        }
        else if (['split', 's'].includes(cmd)) {
            // split <amount> <@who> <name>
            if (parts[1]) config.amount = parseFloat(parts[1]);
            if (parts[2]) config.group = parts[2]; // Will be resolved later
            if (parts[3]) config.expenseName = parts[3].replace(/_/g, ' ');
            config.splitMethod = 'equal';
        }
    }

    return config;
};
