# Relative links

Rebased by default:

<!--- @@inject: docs/part.md --->

## Part

- Image: ![flow](docs/img/flow.png)
- Link: [guide](docs/guide.md#install)
- Up: [license](LICENSE)
- Back to the host: [usage](README.md#usage)
- Reference: [ref][ref]
- Absolute: [site](https://example.com/x.md)
- Root-relative: [root](/docs/x.md)
- Fragment: [part](#part)
- Raw HTML: <img src="img/raw.png">

[ref]: docs/other.md "Other"

<!--- @@inject-end: docs/part.md --->

Opted out:

<!--- @@inject: docs/part.md#rebase-links=false --->

## Part

- Image: ![flow](img/flow.png)
- Link: [guide](./guide.md#install)
- Up: [license](../LICENSE)
- Back to the host: [usage](../README.md#usage)
- Reference: [ref][ref]
- Absolute: [site](https://example.com/x.md)
- Root-relative: [root](/docs/x.md)
- Fragment: [part](#part)
- Raw HTML: <img src="img/raw.png">

[ref]: other.md "Other"

<!--- @@inject-end: docs/part.md#rebase-links=false --->

Opted in explicitly, which wins over `--no-rebase-links`:

<!--- @@inject: docs/part.md#rebase-links --->

## Part

- Image: ![flow](docs/img/flow.png)
- Link: [guide](docs/guide.md#install)
- Up: [license](LICENSE)
- Back to the host: [usage](README.md#usage)
- Reference: [ref][ref]
- Absolute: [site](https://example.com/x.md)
- Root-relative: [root](/docs/x.md)
- Fragment: [part](#part)
- Raw HTML: <img src="img/raw.png">

[ref]: docs/other.md "Other"

<!--- @@inject-end: docs/part.md#rebase-links --->

Shown as code, never rebased:

<!--- @@inject: docs/part.md#code --->

```markdown
## Part

* Image: ![flow](img/flow.png)
* Link: [guide](./guide.md#install)
* Up: [license](../LICENSE)
* Back to the host: [usage](../README.md#usage)
* Reference: [ref][ref]
* Absolute: [site](https://example.com/x.md)
* Root-relative: [root](/docs/x.md)
* Fragment: [part](#part)
* Raw HTML: <img src="img/raw.png">

[ref]: other.md "Other"
```

<!--- @@inject-end: docs/part.md#code --->

As a quote:

<!--- @@inject: docs/part.md#quote --->

> ## Part
>
> - Image: ![flow](docs/img/flow.png)
> - Link: [guide](docs/guide.md#install)
> - Up: [license](LICENSE)
> - Back to the host: [usage](README.md#usage)
> - Reference: [ref][ref]
> - Absolute: [site](https://example.com/x.md)
> - Root-relative: [root](/docs/x.md)
> - Fragment: [part](#part)
> - Raw HTML: <img src="img/raw.png">
>
> [ref]: docs/other.md "Other"

<!--- @@inject-end: docs/part.md#quote --->

Table cells:

<!--- @@inject: docs/links.csv#markdown --->

| Name  | Link                       |
| ----- | -------------------------- |
| Guide | [guide](docs/guide.md)     |
| Image | ![flow](docs/img/flow.png) |

<!--- @@inject-end: docs/links.csv#markdown --->

<!--- @@inject: docs/links.csv#html-table --->

<table>
<thead>
<tr>
<th>Name</th>
<th>Link</th>
</tr>
</thead>
<tbody>
<tr>
<td>Guide</td>
<td>

[guide](docs/guide.md)

</td>
</tr>
<tr>
<td>Image</td>
<td>

![flow](docs/img/flow.png)

</td>
</tr>
</tbody>
</table>

<!--- @@inject-end: docs/links.csv#html-table --->

<!--- @@inject: docs/links.csv --->

| Name  | Link                     |
| ----- | ------------------------ |
| Guide | \[guide]\(guide.md)      |
| Image | !\[flow]\(img/flow\.png) |

<!--- @@inject-end: docs/links.csv --->

JSON table cells:

<!--- @@inject-table: docs/links.json#markdown --->

| Name  | Link                   | Meta                      |
| ----- | ---------------------- | ------------------------- |
| Guide | [guide](docs/guide.md) |                           |
| Data  | [data](data/x.csv)     | `{"see":"[raw](raw.md)"}` |

<!--- @@inject-end: docs/links.json#markdown --->

Same directory, left as written:

<!--- @@inject: sibling.md --->

See [notes](./notes/a/../b.md).

<!--- @@inject-end: sibling.md --->
