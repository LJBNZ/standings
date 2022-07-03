
function GraphOption(props) {

    const handleChange = event => {
        props.setter(event.target.value);
    }

    var options = [];
    for (const [key, value] of Object.entries(props.options)) {
        options.push(<option key={value} value={value}>{value}</option>);
    }

    return (
        <select defaultValue={props.selected} name={props.name} onChange={handleChange}>
            {options}
        </select>
    );
}

export default GraphOption;