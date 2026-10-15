// @vitest-environment jsdom
import React from 'react';
import { it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Button } from '../../src/components/ui/button';
it('exposes an accessible disabled native control', () => {
  let calls = 0;
  render(
    <Button disabled onClick={() => calls++}>
      Submit report
    </Button>,
  );
  const button = screen.getByRole('button', { name: 'Submit report' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(calls).toBe(0);
});
