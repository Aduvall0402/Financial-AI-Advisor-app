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

const CAT_COLORS = {
  GROCERY:       '#3b82f6',
  DINING:        '#22c55e',
  TRANSPORT:     '#f59e0b',
  ENTERTAINMENT: '#a855f7',
  SHOPPING:      '#ec4899',
  TRAVEL:        '#06b6d4',
  HEALTH:        '#10b981',
  UTILITIES:     '#6366f1',
  PERSONAL_CARE: '#f472b6',
  EDUCATION:     '#8b5cf6',
  FEES:          '#94a3b8',
  OTHER:         '#64748b',
};

const CAT_INITIALS = {
  GROCERY: 'G', DINING: 'D', TRANSPORT: 'T', ENTERTAINMENT: 'E',
  SHOPPING: 'S', TRAVEL: 'V', HEALTH: 'H', UTILITIES: 'U',
  PERSONAL_CARE: 'P', EDUCATION: 'Ed', FEES: 'F', OTHER: 'O',
};

function StatCard({ label, value, valueColor, sub, subColor }) {
  return (
    <FlexWidget style={{
      flex: 1, flexBasis: 0, backgroundColor: SURFACE, borderRadius: 14,
      padding: 10, borderWidth: 1, borderColor: BORDER, minHeight: 72,
    }}>
      <TextWidget text={label} style={{ color: MUTED, fontSize: 8, marginBottom: 4 }} maxLines={2} />
      <TextWidget text={value} style={{ color: valueColor || TEXT, fontSize: 14, fontWeight: '700' }} maxLines={1} />
      <TextWidget text={sub || ' '} style={{ color: subColor || MUTED, fontSize: 8, marginTop: 3 }} maxLines={1} />
    </FlexWidget>
  );
}

function BudgetRow({ label, category, spent, limit, pct }) {
  const barWidth  = Math.min(100, Math.max(0, pct));
  const overBudget = pct >= 100;
  const color     = CAT_COLORS[category] || ACCENT;
  const barColor  = overBudget ? RED : pct >= 80 ? AMBER : color;
  const remaining = Math.max(0, limit - spent);

  return (
    <FlexWidget style={{ width: 'match_parent', marginBottom: 11 }}>
      {/* Row: icon + name | remaining + pct */}
      <FlexWidget style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 5,
      }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{
            width: 28, height: 28, backgroundColor: color + '28',
            borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 9,
          }}>
            <TextWidget text={CAT_INITIALS[category] || label[0]} style={{ color, fontSize: 11, fontWeight: '700' }} />
          </FlexWidget>
          <TextWidget text={label} style={{ color: TEXT, fontSize: 12, fontWeight: '600' }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text={overBudget ? 'Over!' : `$${remaining.toFixed(0)} left`}
            style={{ color: overBudget ? RED : GREEN, fontSize: 10, fontWeight: '600', marginRight: 7 }}
          />
          <TextWidget text={`${Math.round(pct)}%`} style={{ color: MUTED, fontSize: 10 }} />
        </FlexWidget>
      </FlexWidget>
      {/* Progress bar */}
      <FlexWidget style={{ height: 4, width: 'match_parent', backgroundColor: BORDER, borderRadius: 3, marginBottom: 3 }}>
        <FlexWidget style={{ height: 4, width: `${barWidth}%`, backgroundColor: barColor, borderRadius: 3 }} />
      </FlexWidget>
      {/* Spent / limit */}
      <TextWidget
        text={`$${spent.toFixed(0)} of $${limit.toFixed(0)}`}
        style={{ color: MUTED, fontSize: 10 }}
      />
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
    periodLabel      = 'This Month',
  } = stats;

  const noData = budgets.length === 0 && yesterdaySpent === 0 && budgetTotal === 0;

  return (
    <FlexWidget style={{
      height: 'match_parent', width: 'match_parent',
      backgroundColor: BG, borderRadius: 22, padding: 18,
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <FlexWidget style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', width: 'match_parent', marginBottom: 14,
      }}>
        <FlexWidget style={{ flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={88}
            imageHeight={40}
          />
          <TextWidget text={yesterdayDate} style={{ color: MUTED, fontSize: 10, marginTop: 3 }} />
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: SURFACE, borderRadius: 20,
            paddingVertical: 7, paddingHorizontal: 14,
            borderWidth: 1, borderColor: BORDER,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://scan' }}
        >
          <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 10, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>

      {/* ── Stat cards ── */}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', gap: 7, marginBottom: 12, alignItems: 'stretch' }}>
        <StatCard
          label="Yesterday Spend"
          value={`$${yesterdaySpent.toFixed(2)}`}
          sub=" "
        />
        <StatCard
          label="Budget Left"
          value={`$${budgetLeft.toFixed(0)}`}
          valueColor={budgetLeft > 0 ? GREEN : RED}
          sub={`of $${budgetTotal.toFixed(0)}`}
        />
        <StatCard
          label="Transactions"
          value={`${yesterdayTxCount}`}
          sub="yesterday"
        />
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 12 }} />

      {/* ── Budget section header ── */}
      <FlexWidget style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', width: 'match_parent', marginBottom: 10,
      }}>
        <TextWidget text="Budget Overview" style={{ color: TEXT, fontSize: 13, fontWeight: '700' }} />
        <TextWidget text={periodLabel} style={{ color: MUTED, fontSize: 10 }} />
      </FlexWidget>

      {/* ── Budget rows ── */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {noData ? (
          <TextWidget
            text="Open Finlit and sync your bank to load data."
            style={{ color: MUTED, fontSize: 11, lineHeight: 18 }}
            maxLines={3}
          />
        ) : budgets.length === 0 ? (
          <TextWidget
            text="No budgets set. Open Finlit to create budgets."
            style={{ color: MUTED, fontSize: 11 }}
            maxLines={2}
          />
        ) : (
          budgets.map((b, i) => (
            <BudgetRow
              key={i}
              label={b.label}
              category={b.category}
              spent={b.spent}
              limit={b.limit}
              pct={b.pct}
            />
          ))
        )}
      </FlexWidget>

    </FlexWidget>
  );
}
