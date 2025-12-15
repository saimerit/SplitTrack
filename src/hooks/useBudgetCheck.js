import { useState } from 'react';
import useAppStore from '../store/useAppStore';

const useBudgetCheck = (formData, isEditMode, initialData) => {
    const { categories, transactions } = useAppStore();
    const [budgetWarning, setBudgetWarning] = useState(null);

    const checkBudget = () => {
        if (!formData.category || !formData.amount) return true;

        const cat = categories.find(c => c.name === formData.category);
        if (!cat || !cat.budget) return true;

        const amountNum = parseFloat(formData.amount);
        if (isNaN(amountNum)) return true;

        // Calculate My Share based on Split Method
        let myShareVal = 0;
        if (formData.splitMethod === 'equal') {
            let count = 0;
            if (formData.includeMe) count++;
            if (formData.payer !== 'me' && !formData.selectedParticipants.includes(formData.payer) && formData.includePayer) count++;
            count += (formData.selectedParticipants || []).length;

            if (formData.includeMe && count > 0) {
                myShareVal = amountNum / count;
            }
        } else if (formData.splitMethod === 'percentage') {
            const myPercent = formData.splits?.['me'] || 0;
            myShareVal = (myPercent / 100) * amountNum;
        } else if (formData.splitMethod === 'dynamic') {
            const myPaise = formData.splits?.['me'] || 0;
            myShareVal = myPaise / 100;
        } else {
            // Fallback: If I am included, assume full amount
            if (formData.includeMe) myShareVal = amountNum;
        }

        const now = new Date(formData.date || new Date());
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const currentUsage = transactions
            .filter(t => !t.isDeleted && t.category === formData.category && t.amount > 0)
            .filter(t => {
                if (isEditMode && initialData?.id && t.id === initialData.id) return false;
                const tDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
                const tKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                return tKey === currentMonthKey;
            })
            .reduce((sum, t) => {
                const myShare = t.splits?.['me'] !== undefined ? t.splits['me'] : (t.payer === 'me' ? t.amount : 0);
                return sum + (myShare / 100);
            }, 0);

        if (currentUsage + myShareVal > cat.budget) {
            const newTotal = currentUsage + myShareVal;
            const exceededBy = newTotal - cat.budget;

            setBudgetWarning({
                message: `
                    <div class="space-y-2">
                        <p><strong>Category:</strong> ${formData.category}</p>
                        <p><strong>Monthly Limit:</strong> ₹${cat.budget}</p>
                        <p><strong>Current Usage:</strong> ₹${currentUsage.toFixed(2)}</p>
                        <p><strong>Your Share of this Txn:</strong> ₹${myShareVal.toFixed(2)}</p>
                        <hr class="border-gray-300 dark:border-gray-600"/>
                        <p class="font-bold text-red-600">New Total: ₹${newTotal.toFixed(2)}</p>
                        <p class="text-sm font-semibold text-orange-600">You are exceeding your budget by ₹${exceededBy.toFixed(2)}</p>
                        <p class="text-sm text-gray-500 mt-2">Do you want to proceed?</p>
                    </div>
                 `
            });
            return false;
        }
        return true;
    };

    return {
        budgetWarning,
        setBudgetWarning,
        checkBudget
    };
};

export default useBudgetCheck;
