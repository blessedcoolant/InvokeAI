import { Combobox, Flex, FormControl } from '@invoke-ai/ui-library';
import { useAppDispatch } from 'app/store/storeHooks';
import { useGroupedModelCombobox } from 'common/hooks/useGroupedModelCombobox';
import { fieldMainModelValueChanged } from 'features/nodes/store/nodesSlice';
import { NO_DRAG_CLASS, NO_WHEEL_CLASS } from 'features/nodes/types/constants';
import type {
  CogView4MainModelFieldInputInstance,
  CogView4MainModelFieldInputTemplate,
} from 'features/nodes/types/field';
import { memo, useCallback } from 'react';
import { useCogView4Models } from 'services/api/hooks/modelsByType';
import type { MainModelConfig } from 'services/api/types';

import type { FieldComponentProps } from './types';

type Props = FieldComponentProps<CogView4MainModelFieldInputInstance, CogView4MainModelFieldInputTemplate>;

const CogView4MainModelFieldInputComponent = (props: Props) => {
  const { nodeId, field } = props;
  const dispatch = useAppDispatch();
  const [modelConfigs, { isLoading }] = useCogView4Models();
  const _onChange = useCallback(
    (value: MainModelConfig | null) => {
      if (!value) {
        return;
      }
      dispatch(
        fieldMainModelValueChanged({
          nodeId,
          fieldName: field.name,
          value,
        })
      );
    },
    [dispatch, field.name, nodeId]
  );
  const { options, value, onChange, placeholder, noOptionsMessage } = useGroupedModelCombobox({
    modelConfigs,
    onChange: _onChange,
    isLoading,
    selectedModel: field.value,
  });

  return (
    <Flex w="full" alignItems="center" gap={2}>
      <FormControl
        className={`${NO_WHEEL_CLASS} ${NO_DRAG_CLASS}`}
        isDisabled={!options.length}
        isInvalid={!value && props.fieldTemplate.required}
      >
        <Combobox
          value={value}
          placeholder={placeholder}
          options={options}
          onChange={onChange}
          noOptionsMessage={noOptionsMessage}
        />
      </FormControl>
    </Flex>
  );
};

export default memo(CogView4MainModelFieldInputComponent);
