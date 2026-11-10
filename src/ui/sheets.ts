/* ALT PANELLER — yönlendirici. Her panel sheets/ altında kendi modülünde ({ sig, render, live?, action? });
   açma/kapama, geri yığını, odak, geçiş ve canlı alanlar sheets/core.ts'te. Burada yalnızca kayıt tablosu kurulur. */
import { PANELS } from './sheets/core';
import { plot, skin } from './sheets/plot';
import { map } from './sheets/map';
import { settings } from './sheets/settings';
import { menu } from './sheets/menu';
import { tasks } from './sheets/tasks';
import { coll, arsiv } from './sheets/archive';
import { lb, leagues } from './sheets/league';
import { sezon } from './sheets/season';
import { ozel } from './sheets/special';
import { guide, guideItem } from './sheets/guide';
import { ref } from './sheets/ref';
import { store } from './sheets/store';
import { holding } from './sheets/holding';

Object.assign(PANELS, { plot, skin, map, set: settings, menu, tasks, coll, arsiv, lb, leagues, sezon, ozel, guide, guideItem, ref, store, holding });

export { openSheet, closeSheet, sheetBack, renderSheet, onSheetAction } from './sheets/core';
