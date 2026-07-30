import {
  BasicAlertDialog,
  Button,
  Column,
  Host,
  Row,
  Shape,
  Slider,
  Surface,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  paddingAll,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { StyleSheet } from "react-native";
import {
  hexToRgb,
  rgbToHex,
} from "../lib/group-colors";
import { CustomColorSwatch } from "./custom-color-swatch";
import type { CustomGroupColorPickerProps } from "./custom-group-color-picker.types";

const roundedDialog = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 28,
    topEnd: 28,
    bottomStart: 28,
    bottomEnd: 28,
  },
});

const roundedPreview = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 14,
    topEnd: 14,
    bottomStart: 14,
    bottomEnd: 14,
  },
});

export function CustomGroupColorPicker({
  value,
  selected,
  onValueChange,
}: CustomGroupColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => hexToRgb(value));
  const draftColor = rgbToHex(draft);

  const openPicker = () => {
    setDraft(hexToRgb(value));
    setOpen(true);
  };

  return (
    <>
      <CustomColorSwatch selected={selected} onPress={openPicker} />
      {open ? (
        <Host matchContents style={styles.dialogHost} seedColor={draftColor}>
          <BasicAlertDialog onDismissRequest={() => setOpen(false)}>
            <Surface
              shape={roundedDialog}
              modifiers={[width(320), paddingAll(24)]}
            >
              <Column verticalArrangement={{ spacedBy: 14 }}>
                <Text style={{ typography: "headlineSmall" }}>
                  Custom color
                </Text>
                <Surface
                  color={draftColor}
                  shape={roundedPreview}
                  modifiers={[fillMaxWidth(), height(54)]}
                />
                <Text style={{ typography: "labelLarge" }}>
                  Red · {Math.round(draft.red)}
                </Text>
                <Slider
                  value={draft.red}
                  min={0}
                  max={255}
                  onValueChange={(red) =>
                    setDraft((current) => ({ ...current, red }))
                  }
                />
                <Text style={{ typography: "labelLarge" }}>
                  Green · {Math.round(draft.green)}
                </Text>
                <Slider
                  value={draft.green}
                  min={0}
                  max={255}
                  onValueChange={(green) =>
                    setDraft((current) => ({ ...current, green }))
                  }
                />
                <Text style={{ typography: "labelLarge" }}>
                  Blue · {Math.round(draft.blue)}
                </Text>
                <Slider
                  value={draft.blue}
                  min={0}
                  max={255}
                  onValueChange={(blue) =>
                    setDraft((current) => ({ ...current, blue }))
                  }
                />
                <Row
                  horizontalArrangement="end"
                  verticalAlignment="center"
                >
                  <TextButton onClick={() => setOpen(false)}>
                    <Text>Cancel</Text>
                  </TextButton>
                  <Button
                    onClick={() => {
                      onValueChange(draftColor);
                      setOpen(false);
                    }}
                  >
                    <Text>Done</Text>
                  </Button>
                </Row>
              </Column>
            </Surface>
          </BasicAlertDialog>
        </Host>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  dialogHost: {
    width: 1,
    height: 1,
  },
});
