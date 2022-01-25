import React from "react";
import { Row, Col, FBSelect, Color, BlurableInput, Help } from "../../ui";
import {
  variableFormList, NO_VALUE_SELECTED_DDI, sortVariables, heading, sequences2Ddi,
} from "./variable_form_list";
import { convertDDItoVariable } from "../locals_list/handle_select";
import {
  VariableFormProps, AllowedVariableNodes, VariableNode, OnChange, VariableType,
} from "../locals_list/locals_list_support";
import {
  determineVector, determineDropdown, SequenceMeta, determineVarDDILabel,
  maybeFindVariable,
} from "../../resources/sequence_meta";
import { ResourceIndex, UUID } from "../../resources/interfaces";
import { DefaultValueForm } from "./default_value_form";
import { t } from "../../i18next_wrapper";
import { CoordinateInputBoxes } from "./location_form_coordinate_input_boxes";
import { generateNewVariableLabel } from "./locals_list";
import { error } from "../../toast/toast";
import { cloneDeep } from "lodash";
import { defensiveClone } from "../../util";
import { Numeric, Text } from "farmbot";
import { ToolTips } from "../../constants";
import { Position } from "@blueprintjs/core";
import {
  determineVariableType, newVariableLabel, VariableIcon,
} from "./new_variable";
import { jsonReplacer } from "../step_tiles";
import { selectAllSequences } from "../../resources/selectors_by_kind";

/**
 * If a variable with a matching label exists in local parameter applications
 * (step body, etc.), use it instead of the one in scope declarations.
 */
const maybeUseStepData = ({ resources, bodyVariables, variable, uuid }: {
  resources: ResourceIndex,
  bodyVariables: VariableNode[] | undefined,
  variable: SequenceMeta,
  uuid: UUID,
}): SequenceMeta => {
  const executeStepData = bodyVariables?.filter(v =>
    v.args.label === variable.celeryNode.args.label)[0];
  if (executeStepData) {
    return {
      celeryNode: executeStepData,
      vector: determineVector(executeStepData, resources, uuid),
      dropdown: determineDropdown(executeStepData, resources, uuid),
    };
  }
  return variable;
};

/**
 * Form with an "import from" dropdown and coordinate input boxes.
 * Can be used to set a specific value, import a value, or declare a variable.
 */
export const VariableForm =
  // eslint-disable-next-line complexity
  (props: VariableFormProps) => {
    const { sequenceUuid, resources, bodyVariables, variable, variableType,
      allowedVariableNodes, hideGroups, removeVariable, onChange } = props;
    const { celeryNode, dropdown, vector, isDefault } = maybeUseStepData({
      resources, bodyVariables, variable, uuid: sequenceUuid
    });
    const variableListItems = generateVariableListItems({
      allowedVariableNodes, resources, sequenceUuid, variableType,
    });
    const displayGroups = !hideGroups;
    const list = variableFormList(resources, [], variableListItems,
      displayGroups, variableType);
    /** Variable name. */
    const { label } = celeryNode.args;
    const headerForm = allowedVariableNodes === AllowedVariableNodes.parameter;
    if (headerForm) {
      list.unshift({
        value: label,
        label: determineVarDDILabel({
          label, resources, uuid: sequenceUuid, forceExternal: true,
        }),
        headingId: "Variable",
      });
    }
    if (variable.isDefault && variableType != VariableType.Resource) {
      const defaultDDI = determineDropdown(variable.celeryNode, resources);
      defaultDDI.label = addDefaultTextToLabel(defaultDDI.label);
      list.unshift(defaultDDI);
    }
    const metaVariable =
      maybeFindVariable(celeryNode.args.label, resources, sequenceUuid);
    const usingDefaultValue = celeryNode.kind == "parameter_application" &&
      metaVariable?.celeryNode.kind == "parameter_declaration" &&
      JSON.stringify(celeryNode.args.data_value, jsonReplacer) ==
      JSON.stringify(metaVariable.celeryNode.args.default_value, jsonReplacer);
    const isDefaultValueForm =
      !!props.locationDropdownKey?.endsWith("default_value");
    if (variableType == VariableType.Resource) {
      if (isDefaultValueForm) {
        [
          { label: t("Sequence"), value: "Sequence", headingId: "Resource" },
        ].map(item => list.unshift(item));
      } else if (celeryNode.kind != "parameter_declaration") {
        heading("Sequence")
          .concat(sequences2Ddi(selectAllSequences(resources)))
          .map(item => list.push(item));
      }
    }
    const narrowLabel = !!removeVariable;
    return <div className={"location-form"}>
      <div className={"location-form-content"}>
        <Row>
          {!props.hideWrapper &&
            <Col xs={1}>
              {!isDefaultValueForm &&
                <VariableIcon variableType={variableType} />}
            </Col>}
          {!props.hideWrapper &&
            <Col xs={narrowLabel ? 4 : 5}>
              {isDefaultValueForm
                ? <p>{t("Default value")}</p>
                : <Label label={label} inUse={props.inUse || !removeVariable}
                  allowedVariableNodes={allowedVariableNodes}
                  labelOnly={props.labelOnly}
                  variable={variable} onChange={onChange} />}
              {isDefaultValueForm &&
                <Help text={ToolTips.DEFAULT_VALUE} position={Position.TOP_LEFT} />}
              {isDefaultValueForm && isDefault &&
                <Help text={ToolTips.USING_DEFAULT_VARIABLE_VALUE}
                  customIcon={"exclamation-triangle"} onHover={true} />}
            </Col>}
          {([VariableType.Location, VariableType.Resource]
            .includes(variableType)
            || !isDefaultValueForm) &&
            <Col xs={props.hideWrapper ? 12 : 6}>
              <FBSelect
                key={props.locationDropdownKey}
                list={list}
                selectedItem={dropdown}
                customNullLabel={NO_VALUE_SELECTED_DDI().label}
                onChange={ddi => {
                  onChange(convertDDItoVariable({
                    identifierLabel: label,
                    allowedVariableNodes,
                    dropdown: ddi,
                    variableType,
                  }), label);
                }} />
            </Col>}{ }
          {variableType == VariableType.Number && isDefaultValueForm &&
            <NumericInput label={label} variableNode={variable.celeryNode}
              onChange={onChange} />}
          {variableType == VariableType.Text && isDefaultValueForm &&
            <TextInput label={label} variableNode={variable.celeryNode}
              onChange={onChange} />}
          {removeVariable && !isDefaultValueForm &&
            <Col xs={1} className={"trash"}>
              <i className={"fa fa-trash"}
                style={props.inUse ? { color: Color.gray } : {}}
                onClick={() => removeVariable(label)} />
            </Col>}
        </Row>
        {!isDefaultValueForm && variableType == VariableType.Number &&
          celeryNode.kind != "parameter_declaration" &&
          !usingDefaultValue && celeryNode.args.data_value.kind != "identifier" &&
          <Row>
            <Col xs={narrowLabel ? 5 : 6} />
            <NumericInput label={label} variableNode={celeryNode}
              onChange={onChange} />
          </Row>}
        {!isDefaultValueForm && variableType == VariableType.Text &&
          celeryNode.kind != "parameter_declaration" &&
          !usingDefaultValue && celeryNode.args.data_value.kind != "identifier" &&
          <Row>
            <Col xs={narrowLabel ? 5 : 6} />
            <TextInput label={label} variableNode={celeryNode}
              onChange={onChange} />
          </Row>}
        <CoordinateInputBoxes
          variableNode={celeryNode}
          vector={vector}
          hideWrapper={!!props.hideWrapper}
          narrowLabel={narrowLabel}
          onChange={onChange} />
        <DefaultValueForm
          key={props.locationDropdownKey}
          variableNode={celeryNode}
          resources={resources}
          removeVariable={removeVariable}
          onChange={onChange} />
      </div>
    </div>;
  };

const addDefaultTextToLabel = (label: string) => `${t("Default value")} - ${label}`;

export interface NumericInputProps {
  variableNode: VariableNode;
  onChange: OnChange;
  label: string;
}

export const NumericInput = (props: NumericInputProps) => {
  const { variableNode } = props;
  return <Col xs={6} className={"numeric-variable-input"}>
    <BlurableInput type={"number"}
      className={"number-input"}
      onCommit={e => {
        const editableVariable = defensiveClone(variableNode);
        const value = parseFloat(e.currentTarget.value);
        if (editableVariable.kind == "parameter_declaration") {
          (editableVariable.args.default_value as Numeric).args.number = value;
        } else {
          (editableVariable.args.data_value as Numeric).args.number = value;
        }
        props.onChange(editableVariable, props.label);
      }}
      value={variableNode.kind == "parameter_declaration"
        ? (variableNode.args.default_value as Numeric).args.number
        : (variableNode.args.data_value as Numeric).args.number} />
  </Col>;
};

export interface TextInputProps {
  variableNode: VariableNode;
  onChange: OnChange;
  label: string;
}

export const TextInput = (props: TextInputProps) => {
  const { variableNode } = props;
  return <Col xs={6} className={"text-variable-input"}>
    <BlurableInput type={"text"}
      className={"string-input"}
      onCommit={e => {
        const editableVariable = defensiveClone(variableNode);
        const value = e.currentTarget.value;
        if (editableVariable.kind == "parameter_declaration") {
          (editableVariable.args.default_value as Text).args.string = value;
        } else {
          (editableVariable.args.data_value as Text).args.string = value;
        }
        props.onChange(editableVariable, props.label);
      }}
      value={variableNode.kind == "parameter_declaration"
        ? (variableNode.args.default_value as Text).args.string
        : (variableNode.args.data_value as Text).args.string} />
  </Col>;
};

export interface LabelProps {
  label: string;
  inUse: boolean | undefined;
  variable: SequenceMeta;
  onChange: OnChange;
  allowedVariableNodes: AllowedVariableNodes;
  labelOnly?: boolean;
}

interface LabelState {
  labelValue: string;
}

export class Label extends React.Component<LabelProps, LabelState> {
  state: LabelState = { labelValue: this.props.label };

  setLabelValue = (e: React.FormEvent<HTMLInputElement>) =>
    this.setState({ labelValue: e.currentTarget.value });

  UneditableLabel = () => {
    const { labelValue } = this.state;
    const { allowedVariableNodes } = this.props;
    const value = labelValue == "parent" ? t("Location") : labelValue;
    return (allowedVariableNodes == AllowedVariableNodes.parameter
      && !this.props.labelOnly)
      ? <input
        style={{ background: Color.lightGray }}
        value={value}
        readOnly={true}
        onClick={() => error(t("Can't edit variable name while in use."))} />
      : <p className={"variable-label"}>{value}</p>;
  };

  render() {
    const { labelValue } = this.state;
    const { label, inUse, variable, onChange } = this.props;
    return !inUse
      ? <input value={labelValue}
        onBlur={() => {
          const editableVariable = cloneDeep(variable.celeryNode);
          if (editableVariable.args.label != labelValue) {
            editableVariable.args.label = labelValue;
            onChange(editableVariable, label);
          }
        }}
        onChange={this.setLabelValue} />
      : <this.UneditableLabel />;
  }
}

export interface GenerateVariableListProps {
  allowedVariableNodes: AllowedVariableNodes;
  resources: ResourceIndex;
  sequenceUuid: UUID;
  headingId?: string;
  variableType: VariableType;
}

export const generateVariableListItems = (props: GenerateVariableListProps) => {
  const { allowedVariableNodes, resources, sequenceUuid } = props;
  const headingId = props.headingId || "Variable";
  const variables = sortVariables(Object.values(
    resources.sequenceMetas[sequenceUuid] || [])).map(v => v.celeryNode);
  const displayVariables = allowedVariableNodes !== AllowedVariableNodes.variable;
  if (!displayVariables) { return []; }
  const headerForm = allowedVariableNodes === AllowedVariableNodes.parameter;
  if (headerForm) { return []; }
  const oldVariables = variables
    .filter(v => determineVariableType(v) == props.variableType)
    .map(variable_ => ({
      value: variable_.args.label,
      label: determineVarDDILabel({
        label: variable_.args.label,
        resources,
        uuid: sequenceUuid,
      }),
      headingId,
    }));
  const newVarLabel = generateNewVariableLabel(variables,
    newVariableLabel(props.variableType));
  const newVariable = [{
    value: newVarLabel,
    label: determineVarDDILabel({
      label: newVarLabel,
      resources,
      uuid: sequenceUuid,
    }),
    headingId,
  }];
  return oldVariables.concat(newVariable);
};
