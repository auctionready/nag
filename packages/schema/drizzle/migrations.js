// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_jazzy_winter_soldier.sql';
import m0001 from './0001_fresh_corsair.sql';
import m0002 from './0002_premium_violations.sql';
import m0003 from './0003_wise_bug.sql';
import m0004 from './0004_glossy_the_hand.sql';
import m0005 from './0005_conscious_wonder_man.sql';
import m0006 from './0006_replace_day_of_week_with_days.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006
    }
  }
  