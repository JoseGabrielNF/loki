import { actionTypes, mutationTypes } from '../../store'

export default class AzBpmProcess {
    constructor(store, processKey, businessKey) {
        this.store = store
        this.processKey = processKey
        this.businessKey = businessKey

        this.initialize()
    }

    async load() {
        return this._loadProcessInstance().then((processInstance) => {
            const currentTask = this._getCurrentTaskInProcess()
            this._setCurrentTaskInInstance(currentTask)

            const task = this._hasValidCurrentTask() ? this._getCurrentTask() : this._getFirstValidCurrentTask()

            this._setCurrentTaskInInstance(task)
            this._setCurrentTaskInProcess(task)

            return processInstance
        })
    }

    initialize() {
        return this.store.commit(mutationTypes.BPM.INITIALIZE_PROCESS_INSTANCE, this._getProcessParams())
    }

    hasAuthority(authorities = []) {
        const currentTask = this._getCurrentTask()

        return (
            !this.isLoadingProcess() &&
            this._isStatusInstanceActive() &&
            this._hasAssignee(currentTask) &&
            this._hasSomeValidAuthority(currentTask, authorities) &&
            this._isUserCandidate(currentTask)
        )
    }

    getProcess() {
        const bpm = this.store.state.loki.bpm || {}
        const bpmAtProcessKey = bpm.process[this.processKey] || {}

        return bpmAtProcessKey[this.businessKey] || {}
    }

    getProcessInstance() {
        const process = this.getProcess()

        return process.instance || null
    }

    getComponents() {
        return {
            select: {
                humanDecision: this.getSelectHumanDecision(),
                parallel: this.getSelectParallel(),
            },
            button: {
                claim: this.getButtonClaim(),
                unclaim: this.getButtonUnclaim(),
                complete: this.getButtonComplete(),
                uncomplete: this.getButtonUncomplete(),
            },
        }
    }

    getSelectHumanDecision() {
        return {
            show: this._getSelectHumanDecisionShow(),
            disabled: this._getSelectHumanDecisionDisabled(),
            items: this._getSelectHumanDecisionItems(),
        }
    }

    getSelectParallel() {
        return {
            show: this._getSelectParallelShow(),
            disabled: this._getSelectParallelDisabled(),
            items: this._getSelectParallelItems(),
        }
    }

    getButtonClaim() {
        return {
            show: this._getButtonClaimShow(),
            disabled: this._getButtonClaimDisabled(),
            label: this._getButtonClaimLabel(),
            action: this._getButtonClaimAction(),
        }
    }

    getButtonUnclaim() {
        return {
            show: this._getButtonUnclaimShow(),
            disabled: this._getButtonUnclaimDisabled(),
            label: this._getButtonUnclaimLabel(),
            action: this._getButtonUnclaimAction(),
        }
    }

    getButtonComplete() {
        return {
            show: this._getButtonCompleteShow(),
            disabled: this._getButtonCompleteDisabled(),
            label: this._getButtonCompleteLabel(),
            action: this._getButtonCompleteAction(),
        }
    }

    getButtonUncomplete() {
        return {
            show: this._getButtonUncompleteShow(),
            disabled: this._getButtonUncompleteDisabled(),
            label: this._getButtonUncompleteLabel(),
            action: this._getButtonUncompleteAction(),
        }
    }

    isLoadingProcess() {
        const process = this.getProcess()

        return process.isLoading || false
    }

    _loadProcessInstance() {
        return this.store.dispatch(actionTypes.BPM.GET_PROCESS_INSTANCE, this._getProcessParams())
    }

    _getCurrentTaskInProcess() {
        const process = this.getProcess()

        return process.currentTask || {}
    }

    _getFirstValidCurrentTask() {
        const currentTasks = [
            ...this._getCurrentTasksThatUserIsCandidate(),
            ...this._getCurrentTasksThatUserIsCandidateInPreviousTask(),
            ...this._getCurrentTasks(),
        ]

        return currentTasks.shift() || null
    }

    _setCurrentTaskInInstance(task) {
        const payload = this._getProcessParams()
        payload.currentTaskId = task.id

        return this.store.commit(mutationTypes.BPM.SET_CURRENT_TASK_FOR_ID_IN_INSTANCE, payload)
    }

    _setCurrentTaskInProcess(task) {
        const payload = this._getProcessParams()
        payload.currentTaskId = task.id

        return this.store.commit(mutationTypes.BPM.SET_CURRENT_TASK_FOR_ID_IN_PROCESS, payload)
    }

    _hasCurrentTasks() {
        const currentTasks = this._getCurrentTasks()

        return currentTasks.length > 0
    }

    _hasValidCurrentTask() {
        return this._hasCurrentTasks() && this._hasCurrentTask() && this._isCurrentTaskInCurrentTasks()
    }

    _isCurrentTaskInCurrentTasks() {
        const currentTasks = this._getCurrentTasks()
        const currentTask = this._getCurrentTask()

        return currentTasks.some((task) => task.id === currentTask.id)
    }

    _getSelectHumanDecisionShow() {
        const currentTask = this._getCurrentTask()

        return Boolean(
            this._hasHumanDecisionInAllNextTasks(currentTask) &&
                this._hasNextTasks(currentTask) &&
                this._hasAssignee(currentTask) &&
                this._isStatusInstanceActive()
        )
    }

    _getSelectHumanDecisionDisabled() {
        const currentTask = this._getCurrentTask()

        return Boolean(this.isLoadingProcess() || !this._isUserCandidate(currentTask))
    }

    _getSelectHumanDecisionItems() {
        const currentTask = this._getCurrentTask()
        if (!this._hasHumanDecisionInAllNextTasks(currentTask)) {
            return []
        }

        const nextTasks = this._getNextTasks(currentTask)

        return nextTasks.map((task) => ({
            text: task.taskName,
            value: task.taskId,
        }))
    }

    _getSelectParallelShow() {
        return Boolean(
            this._isStatusInstanceActive() &&
                this._hasSomeCurrentTaskThatUserCanInteract() &&
                this._hasMultipleCurrentTasks()
        )
    }

    _getSelectParallelDisabled() {
        const currentTask = this._getCurrentTask()

        return Boolean(this.isLoadingProcess() || !this._isUserCandidate(currentTask))
    }

    _getSelectParallelItems() {
        const currentTasks = this._getCurrentTasks()

        return currentTasks.map((task) => ({
            text: task.name,
            value: task.id,
        }))
    }

    _getButtonClaimShow() {
        const currentTask = this._getCurrentTask()

        return Boolean(this._isStatusInstanceActive() && !this._hasAssignee(currentTask))
    }

    _getButtonClaimDisabled() {
        const currentTask = this._getCurrentTask()

        return Boolean(this.isLoadingProcess() || !this._isUserCandidate(currentTask))
    }

    _getButtonClaimLabel() {
        return 'Receber'
    }

    _getButtonClaimAction() {
        return () => this._dispatchButtonActionOnCurrentTask('claim')
    }

    _getButtonUnclaimShow() {
        const currentTask = this._getCurrentTask()

        return Boolean(this._isStatusInstanceActive() && this._hasAssignee(currentTask))
    }

    _getButtonUnclaimDisabled() {
        const currentTask = this._getCurrentTask()

        return Boolean(this.isLoadingProcess() || !this._isUserCandidate(currentTask))
    }

    _getButtonUnclaimLabel() {
        return 'Cancelar recebimento'
    }

    _getButtonUnclaimAction() {
        return () => this._dispatchButtonActionOnCurrentTask('unclaim')
    }

    _getButtonCompleteShow() {
        const currentTask = this._getCurrentTask()

        return Boolean(this._isStatusInstanceActive() && this._hasAssignee(currentTask))
    }

    _getButtonCompleteDisabled() {
        const currentTask = this._getCurrentTask()

        return Boolean(this.isLoadingProcess() || !this._isUserCandidate(currentTask))
    }

    _getButtonCompleteLabel() {
        const currentTask = this._getCurrentTask()

        return this._hasNextTasks(currentTask) ? 'Encaminhar' : 'Finalizar'
    }

    _getButtonCompleteAction() {
        return (bpmParameters) => this._dispatchButtonActionOnCurrentTask('complete', bpmParameters)
    }

    _getButtonUncompleteShow() {
        const currentTask = this._getCurrentTask()

        return Boolean(
            this._isStatusInstanceActive() && !this._hasAssignee(currentTask) && !this._isFirstTask(currentTask)
        )
    }

    _getButtonUncompleteDisabled() {
        const currentTask = this._getCurrentTask()

        return Boolean(
            this.isLoadingProcess() ||
                !this._isUserCandidateInPreviousTask(currentTask) ||
                this._isUncompleteTaskDisabled(currentTask)
        )
    }

    _getButtonUncompleteLabel() {
        return 'Cancelar encaminhamento'
    }

    _getButtonUncompleteAction() {
        return () => this._dispatchButtonActionOnCurrentTask('uncomplete')
    }

    _getProcessParams() {
        return {
            processKey: this.processKey,
            businessKey: this.businessKey,
        }
    }

    _getUser() {
        return this.store.state.loki.user || null
    }

    _isStatusInstanceActive() {
        const status = this._getProcessInstanceStatus()

        return status === 'ACTIVE'
    }

    _getProcessInstanceStatus() {
        const processInstance = this.getProcessInstance()

        return (processInstance && processInstance.statusInstance) || ''
    }

    _hasAssignee(task) {
        const assignee = this._getAssignee(task)

        return Boolean(assignee)
    }

    _getAssignee(task) {
        return task.assignee || null
    }

    _getCurrentTask() {
        const processInstance = this.getProcessInstance()

        return (processInstance && processInstance.currentTask) || {}
    }

    _hasCurrentTask() {
        const currentTask = this._getCurrentTask()

        return currentTask.id
    }

    _hasSomeValidAuthority(task, authorities = []) {
        const validUserAuthorities = this._getValidUserAuthorities(task, authorities)

        return validUserAuthorities.length > 0
    }

    _getValidUserAuthorities(task, authorities) {
        const userAuthorities = this._getUserAuthorities()

        return userAuthorities.filter((authority) => this._isAuthorityValid(task, authority, authorities))
    }

    _getUserAuthorities() {
        const user = this._getUser()

        return user.authorities || []
    }

    _isAuthorityValid(task, authority, authorities = []) {
        return (
            this._isAuthorityWithAccess(authority) &&
            this._isAuthorityPresentInProps(authority, authorities) &&
            !this._isAuthorityRevoked(task, authority)
        )
    }

    _isAuthorityWithAccess(authority) {
        return authority.hasAccess
    }

    _isAuthorityPresentInProps(authority, authorities = []) {
        return !authorities.length || authorities.includes(authority.name)
    }

    _isAuthorityRevoked(task, authority) {
        const revokedAuthorities = this._getCurrentTaskRevokedAuthorities()

        return revokedAuthorities.length && revokedAuthorities.includes(authority.name)
    }

    _getRevokedAuthorities(task) {
        const revokedPermissions = task.revokedPermissions || ''

        return this._splitCommaSeparatedTextToArray(revokedPermissions)
    }

    _getCurrentTaskRevokedAuthorities() {
        const currentTask = this._getCurrentTask()

        return this._getRevokedAuthorities(currentTask)
    }

    _splitCommaSeparatedTextToArray(text) {
        return text.replace(/\s+/g, '').split(',').filter(Boolean)
    }

    _isUserCandidate(task) {
        return this._isUserInCandidateUsers(task) || this._isUserInCandidateGroups(task)
    }

    _isUserInCandidateUsers(task) {
        const candidateUsers = this._getCandidateUsers(task)
        const user = this._getUser()

        return candidateUsers.includes(user.name)
    }

    _getCandidateUsers(task) {
        return task.candidateUsers || []
    }

    _isUserInCandidateGroups(task) {
        const userRoles = this._getUserRoles()
        const candidateGroups = this._getCandidateGroups(task)

        return userRoles.some((role) => candidateGroups.includes(role))
    }

    _getUserRoles() {
        const user = this._getUser()

        return user.roles || []
    }

    _getCandidateGroups(task) {
        return task.candidateGroups || []
    }

    _getNextTasks(task) {
        return task.nextTasks || []
    }

    _hasNextTasks(task) {
        const nextTasks = this._getNextTasks(task)

        return nextTasks.length > 0
    }

    _hasHumanDecisionInAllNextTasks(task) {
        const nextTasks = this._getNextTasks(task)
        const hasNextTasks = nextTasks.length > 0

        return hasNextTasks && nextTasks.every((task) => this._isHumanDecisionTask(task))
    }

    _isHumanDecisionTask(task) {
        const flowExpression = task.flowExpression

        return flowExpression && flowExpression.includes('humanDecision')
    }

    _isFirstTask(task) {
        return task.firstTask || false
    }

    _getPreviousTask(task) {
        return task.previousTask || {}
    }

    _isUserAssignee(task) {
        const user = this._getUser()
        const assignee = this._getAssignee(task)

        return user.name === assignee
    }

    _isUncompleteTaskDisabled(task) {
        if (task.isParallel) {
            return true
        }

        const previousTask = this._getPreviousTask(task)
        if (previousTask.isNextNodeParallelHasSingleOutgoing) {
            return true
        }

        if (previousTask.isNextNodeParallelHasMultipleOutgoing) {
            const currentTasks = this._getCurrentTasks()
            const tasksGenerated = currentTasks.filter((task) => task.previousTask.key === previousTask.key)
            const tasksGeneratedWithoutAssignee = tasksGenerated.filter((task) => !task.assignee)
            const hasMultipleTasks = tasksGeneratedWithoutAssignee.length > 1

            return !hasMultipleTasks
        }

        return false
    }

    _getCurrentTasks() {
        const processInstance = this.getProcessInstance()

        return (processInstance && processInstance.currentTasks) || []
    }

    _hasMultipleCurrentTasks() {
        const currentTasks = this._getCurrentTasks()

        return currentTasks.length > 1
    }

    _hasSomeCurrentTaskThatUserCanInteract() {
        return (
            this._hasSomeCurrentTaskThatUserIsCandidate() || this._hasSomeCurrentTaskThatUserIsCandidateInPreviousTask()
        )
    }

    _hasSomeCurrentTaskThatUserIsCandidate() {
        const currentTasksThatUserIsCandidate = this._getCurrentTasksThatUserIsCandidate()

        return currentTasksThatUserIsCandidate.length > 0
    }

    _getCurrentTasksThatUserIsCandidate() {
        const currentTasks = this._getCurrentTasks()

        return currentTasks.filter((task) => this._isUserCandidate(task))
    }

    _hasSomeCurrentTaskThatUserIsCandidateInPreviousTask() {
        const currentTasksThatUserIsCandidateInPreviousTask = this._getCurrentTasksThatUserIsCandidateInPreviousTask()

        return currentTasksThatUserIsCandidateInPreviousTask.length > 0
    }

    _getCurrentTasksThatUserIsCandidateInPreviousTask() {
        const currentTasks = this._getCurrentTasks()

        return currentTasks.filter((task) => this._isUserCandidateInPreviousTask(task))
    }

    _isUserCandidateInPreviousTask(task) {
        const previousTask = this._getPreviousTask(task)

        return this._isUserAssignee(previousTask) || this._isUserInCandidateGroups(previousTask)
    }

    _dispatchButtonActionOnCurrentTask(buttonType, bpmParameters) {
        const result = this._createButtonActionResult(buttonType)

        return this.load()
            .then(() => this._dispatchButtonActionIfAllowed(buttonType, bpmParameters))
            .then((actionResponse) => {
                result.response = actionResponse
                return this.load()
            })
            .then(() => {
                result.processInstance = this.getProcessInstance()
            })
            .catch((error) => {
                result.error = error
            })
            .then(() => result)
    }

    _dispatchButtonActionIfAllowed(buttonType, bpmParameters) {
        if (!this._isButtonAllowed(buttonType)) {
            throw new Error('Não foi possível realizar essa ação.')
        }

        const actionType = this._createButtonActionType(buttonType)
        const args = this._createButtonActionArgs(bpmParameters)

        return this.store.dispatch(actionType, args)
    }

    _isButtonAllowed(buttonType) {
        const components = this.getComponents()
        const button = components.button[buttonType]

        return !button.disabled && button.show
    }

    _createButtonActionType(buttonType) {
        const actionName = buttonType.toUpperCase()

        return actionTypes.BPM[actionName]
    }

    _createButtonActionArgs(bpmParameters) {
        const currentTask = this._getCurrentTask()

        return {
            bpmParameters,
            taskId: currentTask.id,
        }
    }

    _createButtonActionResult(buttonType) {
        return {
            action: buttonType,
            processInstance: null,
            response: null,
            error: null,
        }
    }
}
