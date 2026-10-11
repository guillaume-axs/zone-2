#!/usr/bin/env bash
# Chaque flux Maestro tourne seul, sur une app constatée fermée : relancée trop
# tôt, Android la tuait parfois en finissant de fermer la précédente (écran noir).
echecs=0
for flux in .maestro/*.yaml; do
  adb shell am force-stop fr.zone2.app
  for i in $(seq 1 100); do
    if ! adb shell pidof fr.zone2.app >/dev/null && ! adb shell dumpsys activity activities | grep -q "ActivityRecord.*fr.zone2.app"; then break; fi
    if [ "$i" = 100 ]; then echo "L'app ne se ferme pas avant $flux"; exit 1; fi
    sleep 0.2
  done
  maestro test "$flux" --test-output-dir="maestro/$(basename "$flux" .yaml)" || echecs=$((echecs+1))
done
exit $echecs
