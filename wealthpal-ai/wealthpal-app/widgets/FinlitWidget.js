import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function FinlitWidget({ width, height }) {
  const compact = height < 120;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        backgroundColor: '#0e1521',
        borderRadius: 20,
        padding: 14,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'finlit://chat' }}
    >
      {/* Header row: icon + app name */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: compact ? 4 : 8,
        }}
      >
        <FlexWidget
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: '#16b7f6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
          }}
        >
          <TextWidget
            text="✦"
            style={{ color: '#ffffff', fontSize: 16, textAlign: 'center' }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <TextWidget
            text="Finlit AI"
            style={{
              color: '#eef2ff',
              fontSize: 14,
              fontWeight: 'bold',
            }}
          />
          {!compact && (
            <TextWidget
              text="Financial Assistant"
              style={{ color: '#4a6070', fontSize: 10 }}
            />
          )}
        </FlexWidget>
      </FlexWidget>

      {/* Tagline */}
      {!compact && (
        <TextWidget
          text="Ask me anything about your finances"
          style={{
            color: '#6b7a8f',
            fontSize: 11,
            width: 'match_parent',
            marginBottom: 10,
          }}
          maxLines={1}
          truncate="END"
        />
      )}

      {/* Ask AI button */}
      <FlexWidget
        style={{
          backgroundColor: '#16b7f6',
          borderRadius: 12,
          paddingVertical: compact ? 6 : 9,
          paddingHorizontal: 14,
          justifyContent: 'center',
          alignItems: 'center',
          width: 'match_parent',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'finlit://chat' }}
      >
        <TextWidget
          text="Ask AI →"
          style={{
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
