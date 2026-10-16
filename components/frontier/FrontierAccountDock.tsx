'use client';

import { FrontierAccount } from './FrontierAccount';
import styles from './frontier-account-dock.module.css';

export function FrontierAccountDock() {
  return (
    <div className={styles.dock}>
      <FrontierAccount />
    </div>
  );
}
