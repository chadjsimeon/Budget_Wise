import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetPage from './Budget';

describe('Budget Component', () => {
  describe('Category Group Creation', () => {
    test('opens modal when Add Category Group button is clicked', async () => {
      // Given: The component renders
      const user = userEvent.setup();
      render(<BudgetPage />);

      // When: The Add Category Group button is clicked
      const addButton = screen.getByRole('button', { name: /add category group/i });
      await user.click(addButton);

      // Then: The modal opens with the correct info
      // Wait for dialog to appear (async portal rendering)
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // And: The modal has the correct info
      verifyAddCategoryGroupModal();
    });

    function verifyAddCategoryGroupModal() {
      const dialogTitle = screen.getByRole('heading', {name: /add category group/i});
      expect(dialogTitle).toBeInTheDocument();
      expect(dialogTitle).toHaveTextContent('Add Category Group');

      // Verify input field
      const nameInput = screen.getByPlaceholderText(/e.g. monthly bills/i);
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue('');

      // Verify preset badges (all 13)
      const presets = [
        'Housing',
        'Food',
        'Transportation',
        'Insurance',
        'Healthcare',
        'Debt Payments',
        'Savings',
        'Lifestyle',
        'Entertainment',
        'Personal Care',
        'Education',
        'Gifts & Donations',
        'Other',
      ];

      presets.forEach((preset) => {
        expect(screen.getByText(preset)).toBeInTheDocument();
      });

      // Verify action buttons
      expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
      const createButton = screen.getByRole('button', {name: /create group/i});
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveTextContent('Create Group');
    }
  });
});
