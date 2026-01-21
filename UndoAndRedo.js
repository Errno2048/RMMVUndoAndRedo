/*:
 * @plugindesc Adds undo and redo functionality to the game state.
 * @author Errno
 * @help
 * 
 * @param capacity
 * @type number
 * @desc The maximum number of undo states to store.
 * @default 20
 * 
 * @param eventNamePattern
 * @type string
 * @desc A regular expression of event name patterns that trigger an undo state save when activated.
 * @default 
 */

function UndoManager () {
    throw new Error('This is a static class');
}

(function(){
	var pluginParameters = PluginManager.parameters('UndoAndRedo');
    var paramCapacity = Number(pluginParameters['capacity'] || 20);
    var paramEventNamePattern = String(pluginParameters['eventNamePattern'] || '');

    var regexEventNamePattern = paramEventNamePattern ? new RegExp(paramEventNamePattern) : null;

    UndoManager.clear = function() {
        this._history = [];
        this._index = 0;
        this._undoIndex = 0;
    }
    UndoManager.clear();

    UndoManager._getCurrentState = function() {
        var json = JsonEx.stringify(DataManager.makeSaveContents());
        return json;
    };

    UndoManager._setCurrentState = function(state) {
        DataManager.createGameObjects();
        DataManager.extractSaveContents(JsonEx.parse(state));
        Scene_Load.prototype.onLoadSuccess.call({
            fadeOutAll: () => {},
            reloadMapIfUpdated: Scene_Load.prototype.reloadMapIfUpdated
        });
    };

    UndoManager._resetUndoIndex = function() {
        if (this._history.length < paramCapacity) {
            this._undoIndex = this._history.length;
        } else {
            this._undoIndex = this._index;
        }
    };

    UndoManager._getNextUndoIndex = function() {
        var size = Math.min(this._history.length, paramCapacity);
        return (this._undoIndex + size - 1) % size;
    };

    UndoManager._getPrevUndoIndex = function() {
        if (this._history.length < paramCapacity) {
            if (this._undoIndex >= this._history.length - 1) {
                return -1;
            }
            return this._undoIndex + 1;
        }
        if (this._undoIndex === (this._index + paramCapacity - 1) % paramCapacity) {
            return -1;
        }
        return (this._undoIndex + 1) % paramCapacity;
    }

    UndoManager.save = function(currentState) {
        currentState = currentState || this._getCurrentState();
        if (this._history.length < paramCapacity) {
            this._history = this._history.slice(0, this._undoIndex);
            this._history.push(currentState);
        } else {
            this._index = this._undoIndex;
            this._history[this._index++] = currentState;
            this._index %= paramCapacity;
        }
        this._resetUndoIndex();
    };

    UndoManager.undo = function() {
        if (this._history.length === 0) {
            return;
        }
        var nextIndex = this._getNextUndoIndex();
        console.log(nextIndex, this._history.length);
        UndoManager._setCurrentState(this._history[nextIndex]);
        this._undoIndex = nextIndex;
    };

    UndoManager.redo = function() {
        if (this._history.length === 0) {
            return;
        }
        var prevIndex = this._getPrevUndoIndex();
        if (prevIndex === -1) {
            return;
        }
        console.log(prevIndex, this._history.length);
        UndoManager._setCurrentState(this._history[prevIndex]);
        this._undoIndex = prevIndex;
    };

    var _Game_Player_startMapEvent = Game_Player.prototype.startMapEvent;
    Game_Player.prototype.startMapEvent = function(x, y, triggers, normal) {
        var currentState = null, events = null;
        if (!$gameMap.isEventRunning()) {
            currentState = UndoManager._getCurrentState();
            events = $gameMap.eventsXy(x, y).filter((event) => { return event.isTriggerIn(triggers) && event.isNormalPriority() === normal; });
        }
        _Game_Player_startMapEvent.call(this, x, y, triggers, normal);
        if (currentState && events && events.length > 0) {
            if (regexEventNamePattern) {
                var matched = events.some((event) => {
                    return regexEventNamePattern.test(event.event().name);
                });
                if (matched) {
                    UndoManager.save(currentState);
                }
            }
        }
    };
})();