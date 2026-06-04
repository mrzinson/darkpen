import { AlertButton, AlertOptions } from 'react-native';

export interface AlertData {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

type AlertListener = (data: AlertData | null) => void;

let alertListener: AlertListener | null = null;

export const registerAlertListener = (listener: AlertListener) => {
  alertListener = listener;
};

export const unregisterAlertListener = () => {
  alertListener = null;
};

export const showCustomAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  if (alertListener) {
    alertListener({ title, message, buttons, options });
  } else {
    console.warn('Custom alert listener not registered');
  }
};
