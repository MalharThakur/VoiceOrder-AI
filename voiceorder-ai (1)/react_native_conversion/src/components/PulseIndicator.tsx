import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { COLORS } from '../theme';

interface PulseIndicatorProps {
  isRecording: boolean;
  children: React.ReactNode;
}

export const PulseIndicator: React.FC<PulseIndicatorProps> = ({ isRecording, children }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isRecording, pulseAnim]);

  return (
    <View style={styles.container}>
      {isRecording && (
        <>
          <Animated.View
            style={[
              styles.pulseOuter,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseInner,
              { transform: [{ scale: Animated.multiply(pulseAnim, 0.85) }] },
            ]}
          />
        </>
      )}
      <View style={styles.childContainer}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pulseOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(251, 113, 133, 0.18)', // matches Color(0x2efb7185)
  },
  pulseInner: {
    position: 'absolute',
    width: 105,
    height: 105,
    borderRadius: 52.5,
    backgroundColor: '#FECDD3', // matches Color(0xFFFECDD3)
  },
  childContainer: {
    zIndex: 2,
  },
});
