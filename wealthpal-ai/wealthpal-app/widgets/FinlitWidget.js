import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';

const ACCENT = '#16b7f6';
const BG = '#07111f';
const SURFACE = '#0e1e30';
const BORDER = '#172536';
const TEXT = '#ddeeff';
const MUTED = '#4a6a88';

function BudgetRow({ label, spent, limit, pct }) {
  const barWidth = Math.min(100, pct);
  const overBudget = pct >= 100;
  const barColor = overBudget ? '#ef4444' : pct >= 80 ? '#f59e0b' : ACCENT;
  return (
    <FlexWidget style={{ width: 'match_parent', marginBottom: 7 }}>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <TextWidget
          text={label}
          style={{ color: TEXT, fontSize: 11, fontWeight: '600' }}
        />
        <TextWidget
          text={`$${spent.toFixed(0)} / $${limit.toFixed(0)}`}
          style={{ color: overBudget ? '#ef4444' : MUTED, fontSize: 10 }}
        />
      </FlexWidget>
      <FlexWidget style={{ height: 4, width: 'match_parent', backgroundColor: BORDER, borderRadius: 2 }}>
        <FlexWidget
          style={{
            height: 4,
            width: `${barWidth}%`,
            backgroundColor: barColor,
            borderRadius: 2,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export function FinlitWidget({ width, height, view, newsletter, budgetData, newsletterDate }) {
  const compact = height < 160;
  const budgets = budgetData ? JSON.parse(budgetData) : [];

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 14,
      }}
    >
      {/* Header: logo + action label */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 10,
        }}
      >
        <ImageWidget
          image={require('../assets/finlit-logo.png')}
          imageWidth={72}
          imageHeight={26}
        />
        {view === 'budget' ? (
          <FlexWidget
            style={{
              backgroundColor: SURFACE,
              borderRadius: 8,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: BORDER,
            }}
            clickAction="SHOW_HOME"
            clickActionData={{}}
          >
            <TextWidget text="Back" style={{ color: ACCENT, fontSize: 11, fontWeight: '600' }} />
          </FlexWidget>
        ) : (
          <TextWidget
            text={newsletterDate || ''}
            style={{ color: MUTED, fontSize: 9 }}
          />
        )}
      </FlexWidget>

      {/* Divider */}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 10 }} />

      {view === 'budget' ? (
        /* ── BUDGET VIEW ── */
        <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
          {budgets.length === 0 ? (
            <TextWidget
              text="No budgets set. Open Finlit to create budgets."
              style={{ color: MUTED, fontSize: 11 }}
              maxLines={3}
            />
          ) : (
            budgets.slice(0, compact ? 3 : 5).map((b, i) => (
              <BudgetRow key={i} label={b.label} spent={b.spent} limit={b.limit} pct={b.pct} />
            ))
          )}
        </FlexWidget>
      ) : (
        /* ── HOME VIEW ── */
        <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
          <TextWidget
            text={newsletter || 'Your daily spending digest will appear here after your next sync.'}
            style={{ color: newsletter ? TEXT : MUTED, fontSize: compact ? 11 : 12, lineHeight: compact ? 17 : 20 }}
            maxLines={compact ? 3 : 5}
            truncate="END"
          />
        </FlexWidget>
      )}

      {/* Bottom buttons — only on home view */}
      {view !== 'budget' && (
        <FlexWidget
          style={{ flexDirection: 'row', width: 'match_parent', gap: 8, marginTop: 10 }}
        >
          {/* Scan Receipt */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: SURFACE,
              borderRadius: 10,
              paddingVertical: 9,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: BORDER,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'finlit://scan' }}
          >
            <TextWidget
              text="Scan Receipt"
              style={{ color: TEXT, fontSize: 11, fontWeight: '600', textAlign: 'center' }}
            />
          </FlexWidget>

          {/* View Budget */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: ACCENT,
              borderRadius: 10,
              paddingVertical: 9,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            clickAction="SHOW_BUDGET"
            clickActionData={{}}
          >
            <TextWidget
              text="View Budget"
              style={{ color: '#ffffff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}
            />
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
