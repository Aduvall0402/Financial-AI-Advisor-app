import React from 'react';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { FinlitWidget } from './widgets/FinlitWidget';

async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }) {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    default:
      renderWidget(
        <FinlitWidget width={widgetInfo.width} height={widgetInfo.height} />
      );
      break;
    case 'WIDGET_DELETED':
      break;
  }
}

registerWidgetTaskHandler(widgetTaskHandler);
