import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Hook utilitário para escutar a abertura e fechamento do teclado virtual no Android e iOS,
 * retornando a altura exata em pixels/dp para elevar drawers e modais.
 */
export function useKeyboardBottomInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}
