import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { FinlitWidget } from './widgets/FinlitWidget';

const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

const PROMPTS = {
  BUDGET: 'How is my budget doing this pay period? Give a concise 1-2 sentence answer.',
  SPENDING: 'Give me a brief summary of my recent spending in 1-2 sentences.',
  TIP: 'Give me one short financial tip or insight about my finances in 1-2 sentences.',
};

async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget, clickAction }) {
  const userId = await AsyncStorage.getItem('widgetUserId');
  const lastResponse = await AsyncStorage.getItem('widgetLastResponse') || '';

  if (!userId) {
    renderWidget(
      <FinlitWidget
        width={widgetInfo.width}
        height={widgetInfo.height}
        response="Sign in to the Finlit app to unlock AI answers."
        activePrompt=""
        isLoading={false}
      />
    );
    return;
  }

  if (widgetAction === 'WIDGET_CLICK' && PROMPTS[clickAction]) {
    // Show loading state immediately
    renderWidget(
      <FinlitWidget
        width={widgetInfo.width}
        height={widgetInfo.height}
        response="Thinking..."
        activePrompt={clickAction}
        isLoading={true}
      />
    );

    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: PROMPTS[clickAction], today, history: [] }),
      });

      const data = await res.json();
      let response;

      if (res.status === 429) {
        response = 'Daily AI limit reached. Open the app to upgrade to Premium for unlimited access.';
      } else if (!res.ok) {
        response = 'Something went wrong. Try again in a moment.';
      } else {
        response = data.response || 'No response received.';
      }

      await AsyncStorage.setItem('widgetLastResponse', response);

      renderWidget(
        <FinlitWidget
          width={widgetInfo.width}
          height={widgetInfo.height}
          response={response}
          activePrompt={clickAction}
          isLoading={false}
        />
      );
    } catch {
      const errMsg = 'No internet connection. Try again when online.';
      renderWidget(
        <FinlitWidget
          width={widgetInfo.width}
          height={widgetInfo.height}
          response={errMsg}
          activePrompt={clickAction}
          isLoading={false}
        />
      );
    }
    return;
  }

  // Default render (added, updated, resized)
  const displayText = lastResponse || 'Tap a question below for an instant AI answer — no app needed.';
  renderWidget(
    <FinlitWidget
      width={widgetInfo.width}
      height={widgetInfo.height}
      response={displayText}
      activePrompt=""
      isLoading={false}
    />
  );
}

registerWidgetTaskHandler(widgetTaskHandler);
