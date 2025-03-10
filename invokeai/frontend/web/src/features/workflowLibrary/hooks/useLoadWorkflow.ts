import { logger } from 'app/logging/logger';
import { useAppDispatch } from 'app/store/storeHooks';
import { $nodeExecutionStates } from 'features/nodes/hooks/useNodeExecutionState';
import { workflowLoaded } from 'features/nodes/store/actions';
import { $templates } from 'features/nodes/store/nodesSlice';
import { $needsFit } from 'features/nodes/store/reactFlowInstance';
import type { Templates } from 'features/nodes/store/types';
import { WorkflowMigrationError, WorkflowVersionError } from 'features/nodes/types/error';
import type { WorkflowV3 } from 'features/nodes/types/workflow';
import { graphToWorkflow } from 'features/nodes/util/workflow/graphToWorkflow';
import { validateWorkflow } from 'features/nodes/util/workflow/validateWorkflow';
import { toast } from 'features/toast/toast';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { serializeError } from 'serialize-error';
import { checkBoardAccess, checkImageAccess, checkModelAccess } from 'services/api/hooks/accessChecks';
import type { GraphAndWorkflowResponse, NonNullableGraph } from 'services/api/types';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const log = logger('workflows');

const getWorkflowFromStringifiedWorkflowOrGraph = async (data: GraphAndWorkflowResponse, templates: Templates) => {
  if (data.workflow) {
    // Prefer to load the workflow if it's available - it has more information
    const parsed = JSON.parse(data.workflow);
    return await validateWorkflow({
      workflow: parsed,
      templates,
      checkImageAccess,
      checkBoardAccess,
      checkModelAccess,
    });
  } else if (data.graph) {
    // Else we fall back on the graph, using the graphToWorkflow function to convert and do layout
    const parsed = JSON.parse(data.graph);
    const workflow = graphToWorkflow(parsed as NonNullableGraph, true);
    return await validateWorkflow({ workflow, templates, checkImageAccess, checkBoardAccess, checkModelAccess });
  } else {
    throw new Error('No workflow or graph provided');
  }
};

export const useLoadWorkflow = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const loadWorkflow = useCallback(
    async (data: GraphAndWorkflowResponse): Promise<WorkflowV3 | null> => {
      try {
        const templates = $templates.get();
        const { workflow, warnings } = await getWorkflowFromStringifiedWorkflowOrGraph(data, templates);

        $nodeExecutionStates.set({});
        dispatch(workflowLoaded(workflow));
        if (!warnings.length) {
          toast({
            id: 'WORKFLOW_LOADED',
            title: t('toast.workflowLoaded'),
            status: 'success',
          });
        } else {
          toast({
            id: 'WORKFLOW_LOADED',
            title: t('toast.loadedWithWarnings'),
            status: 'warning',
          });

          warnings.forEach(({ message, ...rest }) => {
            log.warn(rest, message);
          });
        }

        $needsFit.set(true);
        return workflow;
      } catch (e) {
        if (e instanceof WorkflowVersionError) {
          // The workflow version was not recognized in the valid list of versions
          log.error({ error: serializeError(e) }, e.message);
          toast({
            id: 'UNABLE_TO_VALIDATE_WORKFLOW',
            title: t('nodes.unableToValidateWorkflow'),
            status: 'error',
            description: e.message,
          });
        } else if (e instanceof WorkflowMigrationError) {
          // There was a problem migrating the workflow to the latest version
          log.error({ error: serializeError(e) }, e.message);
          toast({
            id: 'UNABLE_TO_VALIDATE_WORKFLOW',
            title: t('nodes.unableToValidateWorkflow'),
            status: 'error',
            description: e.message,
          });
        } else if (e instanceof z.ZodError) {
          // There was a problem validating the workflow itself
          const { message } = fromZodError(e, {
            prefix: t('nodes.workflowValidation'),
          });
          log.error({ error: serializeError(e) }, message);
          toast({
            id: 'UNABLE_TO_VALIDATE_WORKFLOW',
            title: t('nodes.unableToValidateWorkflow'),
            status: 'error',
            description: message,
          });
        } else {
          // Some other error occurred
          log.error({ error: serializeError(e) }, t('nodes.unknownErrorValidatingWorkflow'));
          toast({
            id: 'UNABLE_TO_VALIDATE_WORKFLOW',
            title: t('nodes.unableToValidateWorkflow'),
            status: 'error',
            description: t('nodes.unknownErrorValidatingWorkflow'),
          });
        }
        return null;
      }
    },
    [dispatch, t]
  );

  return loadWorkflow;
};
