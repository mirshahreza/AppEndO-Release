export type ComponentUsageHitKind = 'designer' | 'package' | 'shell' | 'server-function';

export type ComponentUsageHitBody = {
  name: string;
  kind: ComponentUsageHitKind;
};
