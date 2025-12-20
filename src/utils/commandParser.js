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

        // NEW: Defaults for Payer and IncludeMe
        payer: defaults.defaultPayer || 'me',
        includeMe: defaults.defaultIncludeMe !== undefined ? defaults.defaultIncludeMe : true,

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
        'sm': 'splitMethod', 'split': 'splitMethod',

        // NEW: Aliases for Payer and IncludeMe
        'by': 'payer', 'paid': 'payer', 'payer': 'payer',
        'inc': 'includeMe', 'include': 'includeMe', 'me': 'includeMe', 'with': 'includeMe'
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
                    // Try multiple date formats
                    let parsedDate = null;

                    // Check for dd/mm/yyyy or dd-mm-yyyy format
                    const dmyMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                    if (dmyMatch) {
                        const day = parseInt(dmyMatch[1], 10);
                        const month = parseInt(dmyMatch[2], 10) - 1; // Month is 0-indexed
                        let year = parseInt(dmyMatch[3], 10);
                        if (year < 100) year += 2000; // Handle 2-digit years
                        parsedDate = new Date(year, month, day);
                    }

                    // Check for yyyy-mm-dd (ISO format)
                    if (!parsedDate) {
                        const isoMatch = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
                        if (isoMatch) {
                            parsedDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
                        }
                    }

                    // Fallback to native parsing
                    if (!parsedDate) {
                        parsedDate = new Date(value);
                    }

                    // Validate the date
                    if (isNaN(parsedDate.getTime())) {
                        throw new Error(`Invalid date: "${value}". Use format: dd/mm/yyyy, dd-mm-yyyy, or yyyy-mm-dd`);
                    }

                    config.date = parsedDate;
                }
            } else if (field === 'includeMe') {
                // Handle Boolean Logic (inc:false, inc:no, inc:0)
                const lower = String(value).toLowerCase();
                config.includeMe = !['false', 'no', '0', 'n'].includes(lower);
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
        }
        else if (['split', 's'].includes(cmd)) {
            // split <amount> <@who> <name>
            if (parts[1]) config.amount = parseFloat(parts[1]);
            if (parts[2]) config.group = parts[2];
            if (parts[3]) config.expenseName = parts[3].replace(/_/g, ' ');
            config.splitMethod = 'equal';
        }
    }

    return config;
};
