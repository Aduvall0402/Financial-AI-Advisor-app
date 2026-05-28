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
  OTHER:         '#64748b',
};

function StatCard({ label, value, valueColor, sub }) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <TextWidget text={label} style={{ color: MUTED, fontSize: 9, marginBottom: 4 }} />
      <TextWidget
        text={value}
        style={{ color: valueColor || TEXT, fontSize: 15, fontWeight: '700' }}
      />
      {sub ? (
        <TextWidget text={sub} style={{ color: MUTED, fontSize: 9, marginTop: 3 }} />
      ) : null}
    </FlexWidget>
  );
}

function CategoryRow({ label, category, spent, limit, pct }) {
  const barWidth = Math.min(100, Math.max(0, pct));
  const overBudget = pct >= 100;
  const color = CAT_COLORS[category] || ACCENT;
  const barColor = overBudget ? RED : pct >= 80 ? AMBER : color;
  const remaining = Math.max(0, limit - spent);

  return (
    <FlexWidget style={{ width: 'match_parent', marginBottom: 10 }}>
      {/* Name row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 5,
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget
            style={{
              width: 26,
              height: 26,
              backgroundColor: color + '28',
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 8,
            }}
          >
            <TextWidget text={label[0]} style={{ color, fontSize: 12, fontWeight: '700' }} />
          </FlexWidget>
          <TextWidget text={label} style={{ color: TEXT, fontSize: 12, fontWeight: '600' }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text={`$${remaining.toFixed(0)} left`}
            style={{ color: overBudget ? RED : GREEN, fontSize: 11, fontWeight: '600', marginRight: 8 }}
          />
          <TextWidget
            text={`${Math.round(pct)}%`}
            style={{ color: MUTED, fontSize: 11 }}
          />
        </FlexWidget>
      </FlexWidget>
      {/* Bar */}
      <FlexWidget
        style={{ height: 4, width: 'match_parent', backgroundColor: BORDER, borderRadius: 3, marginBottom: 3 }}
      >
        <FlexWidget
          style={{ height: 4, width: `${barWidth}%`, backgroundColor: barColor, borderRadius: 3 }}
        />
      </FlexWidget>
      {/* Amount */}
      <TextWidget
        text={`$${spent.toFixed(0)} of $${limit.toFixed(0)}`}
        style={{ color: MUTED, fontSize: 10 }}
      />
    </FlexWidget>
  );
}

export function FinlitWidget({ width, height, budgetData, statsData }) {
  const compact = height < 220;
  const budgets = budgetData ? JSON.parse(budgetData) : [];
  const stats   = statsData  ? JSON.parse(statsData)  : {};

  const {
    totalSpent   = 0,
    budgetLeft   = 0,
    budgetTotal  = 0,
    txCount      = 0,
    periodLabel  = 'This Month',
    periodRange  = '',
  } = stats;

  const noData = budgets.length === 0 && totalSpent === 0;

  // ── Compact view ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: BG,
          borderRadius: 20,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={88}
            imageHeight={40}
          />
          <FlexWidget
            style={{
              backgroundColor: SURFACE,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: BORDER,
              marginTop: 12,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'finlit://scan' }}
          >
            <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 12, fontWeight: '600' }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ width: 1, height: 'match_parent', backgroundColor: BORDER, marginHorizontal: 14 }} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={periodLabel} style={{ color: MUTED, fontSize: 10, marginBottom: 8 }} />
          <TextWidget text="Spent" style={{ color: MUTED, fontSize: 10 }} />
          <TextWidget
            text={`$${totalSpent.toFixed(2)}`}
            style={{ color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 10 }}
          />
          <TextWidget text="Budget Left" style={{ color: MUTED, fontSize: 10 }} />
          <TextWidget
            text={`$${budgetLeft.toFixed(2)}`}
            style={{ color: GREEN, fontSize: 18, fontWeight: '700' }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }

  // ── Full view ─────────────────────────────────────────────────────────────
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 12,
        }}
      >
        <ImageWidget
          image={require('../assets/finlit-logo.png')}
          imageWidth={88}
          imageHeight={40}
        />
        <FlexWidget
          style={{
            backgroundColor: SURFACE,
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: BORDER,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://scan' }}
        >
          <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 11, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>

      {/* Period label */}
      <FlexWidget style={{ marginBottom: 10 }}>
        <TextWidget text={periodLabel} style={{ color: TEXT, fontSize: 13, fontWeight: '700' }} />
        {periodRange ? (
          <TextWidget text={periodRange} style={{ color: MUTED, fontSize: 10, marginTop: 2 }} />
        ) : null}
      </FlexWidget>

      {/* ── Stat boxes ── */}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', gap: 8, marginBottom: 12 }}>
        <StatCard
          label="Total Spent"
          value={`$${totalSpent.toFixed(0)}`}
          sub={`of $${budgetTotal.toFixed(0)} budgeted`}
        />
        <StatCard
          label="Budget Left"
          value={`$${budgetLeft.toFixed(0)}`}
          valueColor={budgetLeft > 0 ? GREEN : RED}
          sub={budgetTotal > 0 ? `${Math.round(((budgetTotal - totalSpent) / budgetTotal) * 100)}% remaining` : undefined}
        />
        <StatCard
          label="Transactions"
          value={`${txCount}`}
          sub={periodLabel}
        />
      </FlexWidget>

      {/* Divider */}
      <FlexWidget
        style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 12 }}
      />

      {/* ── Category header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 10,
        }}
      >
        <TextWidget
          text="Spending by Category"
          style={{ color: TEXT, fontSize: 12, fontWeight: '700' }}
        />
        <TextWidget text="View All" style={{ color: ACCENT, fontSize: 11 }} />
      </FlexWidget>

      {/* ── Category rows ── */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {noData ? (
          <TextWidget
            text="Open Finlit and sync your bank to load budget data."
            style={{ color: MUTED, fontSize: 11, lineHeight: 17 }}
            maxLines={3}
          />
        ) : budgets.length === 0 ? (
          <TextWidget
            text="No budgets set. Open Finlit to create budgets."
            style={{ color: MUTED, fontSize: 11 }}
            maxLines={2}
          />
        ) : (
          budgets.slice(0, 5).map((b, i) => (
            <CategoryRow
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
