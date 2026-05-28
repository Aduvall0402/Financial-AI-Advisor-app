import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';

const BG      = '#07111f';
const SURFACE = '#0d1c2e';
const BORDER  = '#172536';
const TEXT    = '#ddeeff';
const MUTED   = '#4a6a88';
const ACCENT  = '#16b7f6';
const GREEN   = '#22c55e';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const BAR_BG  = '#1a2f45';

function BudgetCol({ label, spent, limit, pct }) {
  const filled = Math.min(100, Math.max(1, Math.round(pct)));
  const empty  = 100 - filled;
  const overBudget = pct >= 100;
  const barColor = overBudget ? RED : pct >= 80 ? AMBER : ACCENT;

  return (
    <FlexWidget style={{ flex: 1 }}>
      <TextWidget
        text={label}
        style={{ color: MUTED, fontSize: 8, marginBottom: 2 }}
        maxLines={1}
      />
      <TextWidget
        text={`$${Math.round(spent)}/$${Math.round(limit)}`}
        style={{ color: overBudget ? RED : TEXT, fontSize: 10, fontWeight: '700', marginBottom: 3 }}
        maxLines={1}
      />
      {/* Flex-ratio bar — more reliable than % widths in android widget renderer */}
      <FlexWidget style={{ height: 3, width: 'match_parent', flexDirection: 'row', borderRadius: 2 }}>
        <FlexWidget style={{ flex: filled, height: 3, backgroundColor: barColor, borderRadius: 2 }} />
        <FlexWidget style={{ flex: empty,  height: 3, backgroundColor: BAR_BG,  borderRadius: 2 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function FinlitWidget({ width, height, budgetData, statsData }) {
  const budgets = budgetData ? JSON.parse(budgetData) : [];
  const stats   = statsData  ? JSON.parse(statsData)  : {};

  const {
    yesterdaySpent   = 0,
    yesterdayTxCount = 0,
    budgetLeft       = 0,
    budgetTotal      = 0,
    yesterdayDate    = 'Yesterday',
    periodLabel      = 'This Pay Period',
  } = stats;

  // Group budgets into pairs for two-column layout
  const pairs = [];
  for (let i = 0; i < budgets.length; i += 2) {
    pairs.push(budgets.slice(i, i + 2));
  }

  const noData = budgets.length === 0 && yesterdaySpent === 0 && budgetTotal === 0;

  return (
    <FlexWidget style={{
      height: 'match_parent', width: 'match_parent',
      backgroundColor: BG, borderRadius: 22, padding: 16,
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <FlexWidget style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', width: 'match_parent', marginBottom: 10,
      }}>
        <FlexWidget style={{ flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={80}
            imageHeight={36}
          />
          <TextWidget text={yesterdayDate} style={{ color: MUTED, fontSize: 9, marginTop: 2 }} />
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: SURFACE, borderRadius: 18,
            paddingVertical: 6, paddingHorizontal: 12,
            borderWidth: 1, borderColor: BORDER,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://scan' }}
        >
          <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 9, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>

      {/* ── Stats row: three evenly-spaced text items ── */}
      <FlexWidget style={{
        flexDirection: 'row', width: 'match_parent', marginBottom: 10,
      }}>
        {/* Yesterday — left */}
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="Yesterday" style={{ color: MUTED, fontSize: 8 }} />
          <TextWidget text={`$${yesterdaySpent.toFixed(2)}`} style={{ color: TEXT, fontSize: 13, fontWeight: '700' }} />
        </FlexWidget>

        {/* Budget Left — center */}
        <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
          <TextWidget text="Budget Left" style={{ color: MUTED, fontSize: 8 }} />
          <TextWidget
            text={`$${budgetLeft.toFixed(0)}`}
            style={{ color: budgetLeft > 0 ? GREEN : RED, fontSize: 13, fontWeight: '700' }}
          />
        </FlexWidget>

        {/* Transactions — right */}
        <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
          <TextWidget text="Transactions" style={{ color: MUTED, fontSize: 8 }} />
          <TextWidget text={`${yesterdayTxCount}`} style={{ color: TEXT, fontSize: 13, fontWeight: '700' }} />
        </FlexWidget>
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 8 }} />

      {/* ── Budget section header ── */}
      <FlexWidget style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', width: 'match_parent', marginBottom: 8,
      }}>
        <TextWidget text="Budgets" style={{ color: TEXT, fontSize: 11, fontWeight: '700' }} />
        <TextWidget text={periodLabel} style={{ color: MUTED, fontSize: 8 }} />
      </FlexWidget>

      {/* ── Budget rows (2-column) ── */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {noData ? (
          <TextWidget
            text="Open Finlit and sync your bank to load data."
            style={{ color: MUTED, fontSize: 10 }}
            maxLines={3}
          />
        ) : budgets.length === 0 ? (
          <TextWidget
            text="No budgets set. Open Finlit to create budgets."
            style={{ color: MUTED, fontSize: 10 }}
            maxLines={2}
          />
        ) : (
          pairs.map((pair, pi) => (
            <FlexWidget key={pi} style={{ flexDirection: 'row', width: 'match_parent', gap: 14, marginBottom: 10 }}>
              <BudgetCol
                label={pair[0].label}
                spent={pair[0].spent}
                limit={pair[0].limit}
                pct={pair[0].pct}
              />
              {pair[1] ? (
                <BudgetCol
                  label={pair[1].label}
                  spent={pair[1].spent}
                  limit={pair[1].limit}
                  pct={pair[1].pct}
                />
              ) : (
                <FlexWidget style={{ flex: 1 }} />
              )}
            </FlexWidget>
          ))
        )}
      </FlexWidget>

    </FlexWidget>
  );
}
