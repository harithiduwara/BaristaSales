// Component tests (12.1): each documented state from docs/design/components.md.
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button } from './Button';
import { Banner } from './Banner';
import {
  ChipGroup,
  Checkbox,
  DateField,
  IntegerField,
  MoneyField,
  TextAreaField,
  TextField,
  TimeField,
} from './fields';
import { ConfirmDialog } from './Dialog';
import { PinPad } from './PinPad';
import { Stepper } from './Stepper';
import { ErrorState, EmptyState, KpiCard, ReportRow, Skeleton, SummaryStrip, WhatsAppPreview } from './misc';
import { ToastHost, showToast } from './Toast';
import { AppBar } from './AppBar';
import { BottomNav } from './BottomNav';
import { RoleBadge } from './RoleBadge';
import { outboxState } from '../lib/outbox';
import { session } from '../lib/session';
import type { ListItem } from '@aluthgama/shared';

function Controlled(props: {
  initial?: string;
  error?: string;
  kind: 'money' | 'int' | 'text' | 'area' | 'time' | 'date';
}) {
  const [v, setV] = useState(props.initial ?? '');
  const common = {
    id: 'f',
    label: 'Amount',
    value: v,
    onChange: setV,
    error: props.error,
    hint: 'Hint text',
  };
  switch (props.kind) {
    case 'money':
      return <MoneyField {...common} required />;
    case 'int':
      return <IntegerField {...common} required />;
    case 'text':
      return <TextField {...common} max={10} />;
    case 'area':
      return <TextAreaField {...common} max={10} />;
    case 'time':
      return <TimeField {...common} />;
    case 'date':
      return <DateField {...common} min="2026-11-02" max="2026-11-04" />;
  }
}

describe('MoneyField (V-02, 10.3)', () => {
  it('shows the raw value while focused and the formatted value on blur', async () => {
    render(<Controlled kind="money" initial="1900" />);
    const input = screen.getByLabelText(/Amount/);
    expect(input).toHaveValue('1,900.00');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    await userEvent.click(input);
    expect(input).toHaveValue('1900');
    await userEvent.clear(input);
    await userEvent.type(input, 'Rs 2,500/=');
    expect(input).toHaveValue('Rs 2,500/=');
    fireEvent.blur(input);
    expect(input).toHaveValue('2,500.00');
  });
  it('keeps unparsable text and links the error', () => {
    render(<Controlled kind="money" initial="abc" error="Enter an amount" />);
    const input = screen.getByLabelText(/Amount/);
    expect(input).toHaveValue('abc');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Hint text Enter an amount');
    expect(screen.getByText('(required)')).toHaveClass('sr-only');
  });
});

describe('other fields', () => {
  it.each(['int', 'time', 'date'] as const)('%s field is labelled and accepts input', async (kind) => {
    render(<Controlled kind={kind} error="Bad" />);
    const input = screen.getByLabelText(/Amount/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, {
      target: { value: kind === 'time' ? '07:00' : kind === 'date' ? '2026-11-03' : '12' },
    });
    expect(input).not.toHaveValue('');
  });
  it('text fields count characters', async () => {
    render(<Controlled kind="text" />);
    await userEvent.type(screen.getByLabelText('Amount'), 'Hello');
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
  });
  it('text area counts characters', async () => {
    render(<Controlled kind="area" error="Too long" />);
    await userEvent.type(screen.getByLabelText('Amount'), 'Hello world!');
    expect(screen.getByText('12 / 10')).toBeInTheDocument();
    expect(screen.getByText('Too long')).toBeInTheDocument();
  });
});

describe('ChipGroup', () => {
  it('single select is a radio group and toggles off', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ChipGroup label="Quietest" options={['A', 'B']} value="" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'A' }));
    expect(onChange).toHaveBeenCalledWith('A');
    rerender(<ChipGroup label="Quietest" options={['A', 'B']} value="A" onChange={onChange} error="Nope" />);
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'A' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByText('Nope')).toBeInTheDocument();
  });
  it('multi select uses pressed buttons', async () => {
    const onChange = vi.fn();
    render(
      <ChipGroup label="Busy" multiple options={['A', 'B']} value={['A']} onChange={onChange} hideLabel />,
    );
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith(['A', 'B']);
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe('Button', () => {
  it('shows a spinner only after 400 ms when busy (NFR-PERF-03)', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Button busy>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(container.querySelector('.spinner')).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(container.querySelector('.spinner')).not.toBeNull();
    rerender(<Button icon="share">Submit</Button>);
    expect(container.querySelector('.spinner')).toBeNull();
    vi.useRealTimers();
  });
});

describe('ConfirmDialog', () => {
  it('focuses its first button, traps Tab, and cancels on Escape or backdrop', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        title="Leave?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        Body
      </ConfirmDialog>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Leave?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Leave' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Leave' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('.dialog-scrim') as Element);
    expect(onCancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('alertdialog'));
    expect(onCancel).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onConfirm).toHaveBeenCalled();
    rerender(
      <ConfirmDialog
        open={false}
        title="x"
        confirmLabel="a"
        cancelLabel="b"
        onConfirm={onConfirm}
        onCancel={onCancel}
        danger
      />,
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('PinPad (S-02)', () => {
  it('takes taps and keyboard digits, and deletes', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<PinPad value="12" onChange={onChange} />);
    expect(screen.getByRole('img', { name: '2 of 6 digits entered' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '7' }));
    expect(onChange).toHaveBeenLastCalledWith('127');
    await userEvent.click(screen.getByRole('button', { name: '0' }));
    expect(onChange).toHaveBeenLastCalledWith('120');
    await userEvent.click(screen.getByRole('button', { name: 'Delete last digit' }));
    expect(onChange).toHaveBeenLastCalledWith('1');
    fireEvent.keyDown(window, { key: '5' });
    expect(onChange).toHaveBeenLastCalledWith('125');
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith('1');
    rerender(<PinPad value="123456" onChange={onChange} />);
    onChange.mockClear();
    fireEvent.keyDown(window, { key: '5' });
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    expect(onChange).not.toHaveBeenCalled();
    rerender(<PinPad value="" onChange={onChange} disabled />);
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
  });
});

describe('Stepper (FR-REP-01)', () => {
  it('labels steps, marks the current one and errors, and jumps', async () => {
    const onJump = vi.fn();
    render(<Stepper step={2} errorSteps={new Set([1])} onJump={onJump} />);
    expect(screen.getByText('Step 2 of 5 · Payments and adjustments')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 1, Sales, has errors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Step 2.*current/ })).toHaveAttribute('aria-current', 'step');
    await userEvent.click(screen.getByRole('button', { name: /Step 5/ }));
    expect(onJump).toHaveBeenCalledWith(5);
  });
  it('has no "next" hint on the last step', () => {
    render(<Stepper step={5} errorSteps={new Set()} onJump={() => undefined} />);
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });
});

describe('SummaryStrip (FR-REP-04)', () => {
  it('shows "–" until inputs are there', () => {
    const { rerender } = render(<SummaryStrip total={null} bills={null} uber={null} pickme={null} />);
    expect(screen.getAllByText('–')).toHaveLength(3);
    rerender(<SummaryStrip total={129849.85} bills={46} uber={0} pickme={1900} />);
    expect(screen.getByText('2,822.82')).toBeInTheDocument();
    expect(screen.getByText('1.5%')).toBeInTheDocument();
    expect(screen.getByText('127,949.85')).toBeInTheDocument();
  });
});

describe('ReportRow (FR-HIS-01)', () => {
  const item = {
    businessDate: '2026-11-03',
    total: 129849.85,
    bills: 46,
    uber: 0,
    pickme: 1900,
    weather: null,
  } as unknown as ListItem;
  it('shows date, total, bills, avg and state', () => {
    const { rerender } = render(<ReportRow item={item} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '#/view/2026-11-03');
    expect(screen.getByText('Tue 3 Nov')).toBeInTheDocument();
    expect(screen.getByText('Rs 129,849.85')).toBeInTheDocument();
    expect(screen.getByText('46 bills · avg 2,822.82')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    rerender(
      <ReportRow
        item={{ ...item, bills: 0, total: 0, weather: { rainTradingMm: 6.8 } } as unknown as ListItem}
        pending
      />,
    );
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('0 bills')).toBeInTheDocument();
    expect(screen.getByText('6.8 mm')).toBeInTheDocument();
    rerender(<ReportRow item={{ ...item, weather: { rainTradingMm: 0.4 } } as unknown as ListItem} />);
    expect(screen.getByText('0.4 mm')).toBeInTheDocument();
    rerender(<ReportRow item={{ ...item, weather: { rainTradingMm: 0 } } as unknown as ListItem} />);
    expect(screen.getByText('0.0 mm')).toBeInTheDocument();
  });
});

describe('small components', () => {
  it('KpiCard, EmptyState, Skeleton, ErrorState, Banner, WhatsAppPreview', async () => {
    const retry = vi.fn();
    render(
      <>
        <KpiCard label="Sales" value="1,000.00" detail="3 days" span />
        <KpiCard label="Target" empty="Not set" />
        <EmptyState text="Nothing here" action={<button>Go</button>} />
        <Skeleton rows={2} />
        <ErrorState message="Broke" correlationId="abc-123" onRetry={retry} />
        <ErrorState message="Plain" />
        <Banner tone="success" title="Done">
          <p>Body</p>
        </Banner>
        <WhatsAppPreview text={'*Aluthgama*\n\nDate - 03/11/2026'} />
      </>,
    );
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading…')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Reference: abc-123')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByTestId('whatsapp-preview').querySelector('b')).toHaveTextContent('Aluthgama');
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('Checkbox toggles', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox id="c" checked={false} onChange={onChange}>
        Checked
      </Checkbox>,
    );
    await userEvent.click(screen.getByLabelText('Checked'));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(
      <Checkbox id="c" checked onChange={onChange}>
        Checked
      </Checkbox>,
    );
    expect(screen.getByLabelText('Checked')).toBeChecked();
  });
});

describe('SyncChip (FR-REP-09) and app bar', () => {
  it('shows all sent, waiting and failed, and opens Settings', async () => {
    outboxState.set({ waiting: 0, failed: 0, items: [] });
    session.set((s) => ({ ...s, role: 'Owner' }));
    const onBack = vi.fn();
    render(
      <AppBar
        title="Home"
        subtitle="Wed"
        showRole
        leading={{ icon: 'back', label: 'Back', onClick: onBack }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sync status: All sent' })).toHaveTextContent('All sent');
    expect(screen.getByText('Owner')).toBeInTheDocument();
    act(() => outboxState.set({ waiting: 2, failed: 0, items: [] }));
    expect(screen.getByRole('button', { name: /Sync status/ })).toHaveTextContent('2 waiting to send');
    act(() => outboxState.set({ waiting: 0, failed: 1, items: [] }));
    expect(screen.getByRole('button', { name: /Sync status/ })).toHaveTextContent(
      "Couldn't send – tap for details",
    );
    await userEvent.click(screen.getByRole('button', { name: /Sync status/ }));
    expect(window.location.hash).toBe('#/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    outboxState.set({ waiting: 0, failed: 0, items: [] });
  });

  it('BottomNav marks the current page; RoleBadge hides without a role', () => {
    session.set((s) => ({ ...s, role: null }));
    render(
      <>
        <BottomNav current="/history" />
        <RoleBadge />
      </>,
    );
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByText('Manager')).toBeNull();
  });
});

describe('Toast', () => {
  it('shows and hides after 4 s', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => showToast('Copied'));
    expect(screen.getByText('Copied')).toBeInTheDocument();
    act(() => showToast('Again'));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Again')).toBeNull();
    vi.useRealTimers();
  });
});
